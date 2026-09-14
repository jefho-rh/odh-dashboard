package kubernetes

import (
	"context"
	"crypto/sha256"
	"fmt"
	"sync"
	"time"

	"github.com/opendatahub-io/eval-hub/bff/internal/models"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

const (
	kueueManagedLabel       = "kueue.x-k8s.io/managed"
	legacyKueueManagedLabel = "kueue.openshift.io/managed"
	dscGroup                = "datasciencecluster.opendatahub.io"
	dscVersion              = "v2"
	dscResource             = "datascienceclusters"
	kueueGroup              = "kueue.x-k8s.io"
	kueueVersion            = "v1beta2"
	localQueueResource      = "localqueues"
	kueueAvailabilityTTL    = 15 * time.Second
)

var (
	dscGVR        = schema.GroupVersionResource{Group: dscGroup, Version: dscVersion, Resource: dscResource}
	localQueueGVR = schema.GroupVersionResource{Group: kueueGroup, Version: kueueVersion, Resource: localQueueResource}
	kueueCache    = newKueueAvailabilityCache(kueueAvailabilityTTL)
)

// kueueAvailabilityCache keeps the availability result briefly so the form's
// availability and HardwareProfile requests share one Kubernetes lookup. Cache
// keys contain a hash of the caller token, never the token itself, to preserve
// user-scoped authorization semantics.
type kueueAvailabilityCache struct {
	mu      sync.Mutex
	ttl     time.Duration
	entries map[string]*kueueAvailabilityCacheEntry
}

type kueueAvailabilityCacheEntry struct {
	availability *models.KueueAvailability
	err          error
	expiresAt    time.Time
	done         chan struct{}
}

func newKueueAvailabilityCache(ttl time.Duration) *kueueAvailabilityCache {
	return &kueueAvailabilityCache{
		ttl:     ttl,
		entries: make(map[string]*kueueAvailabilityCacheEntry),
	}
}

func (c *kueueAvailabilityCache) get(
	ctx context.Context,
	key string,
	load func() (*models.KueueAvailability, error),
) (*models.KueueAvailability, error) {
	now := time.Now()
	c.mu.Lock()
	if entry, found := c.entries[key]; found {
		if entry.done != nil {
			done := entry.done
			c.mu.Unlock()
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-done:
			}
			if entry.err != nil {
				return nil, entry.err
			}
			return cloneKueueAvailability(entry.availability), nil
		}
		if now.Before(entry.expiresAt) {
			availability := cloneKueueAvailability(entry.availability)
			c.mu.Unlock()
			return availability, nil
		}
		delete(c.entries, key)
	}

	entry := &kueueAvailabilityCacheEntry{done: make(chan struct{})}
	c.entries[key] = entry
	c.mu.Unlock()

	availability, err := load()

	c.mu.Lock()
	entry.availability = availability
	entry.err = err
	if err == nil {
		entry.expiresAt = time.Now().Add(c.ttl)
	}
	close(entry.done)
	entry.done = nil
	c.mu.Unlock()

	if err != nil {
		return nil, err
	}
	return cloneKueueAvailability(availability), nil
}

func cloneKueueAvailability(availability *models.KueueAvailability) *models.KueueAvailability {
	if availability == nil {
		return nil
	}
	clone := *availability
	clone.LocalQueueNames = append([]string(nil), availability.LocalQueueNames...)
	return &clone
}

func kueueAvailabilityCacheKey(namespace, token string) string {
	tokenHash := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x:%s", tokenHash, namespace)
}

func getCachedKueueAvailability(
	ctx context.Context,
	client dynamic.Interface,
	namespace, cacheKey string,
) (*models.KueueAvailability, error) {
	return kueueCache.get(ctx, cacheKey, func() (*models.KueueAvailability, error) {
		return getKueueAvailability(ctx, client, namespace)
	})
}

func getKueueAvailability(ctx context.Context, client dynamic.Interface, namespace string) (*models.KueueAvailability, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	ns, err := client.Resource(schema.GroupVersionResource{Version: "v1", Resource: "namespaces"}).Get(ctx, namespace, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to read namespace %q: %w", namespace, err)
	}

	labels := ns.GetLabels()
	namespaceManaged := labels[kueueManagedLabel] == "true" || labels[legacyKueueManagedLabel] == "true"
	clusterEnabled := false
	dscList, err := client.Resource(dscGVR).List(ctx, metav1.ListOptions{})
	if err != nil && !k8serrors.IsNotFound(err) {
		return nil, fmt.Errorf("failed to list DataScienceClusters: %w", err)
	}
	if err == nil {
		for _, dsc := range dscList.Items {
			components, _, _ := unstructured.NestedMap(dsc.Object, "spec", "components")
			kueue, _, _ := unstructured.NestedMap(components, "kueue")
			managementState, _, _ := unstructured.NestedString(kueue, "managementState")
			if managementState == "Managed" {
				clusterEnabled = true
				break
			}
		}
	}
	if !clusterEnabled || !namespaceManaged {
		return &models.KueueAvailability{
			Enabled:              false,
			ClusterEnabled:       clusterEnabled,
			NamespaceManaged:     namespaceManaged,
			LocalQueuesAvailable: false,
			LocalQueueNames:      []string{},
		}, nil
	}

	queues, err := client.Resource(localQueueGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			return &models.KueueAvailability{
				Enabled:              false,
				ClusterEnabled:       clusterEnabled,
				NamespaceManaged:     namespaceManaged,
				LocalQueuesAvailable: false,
				LocalQueueNames:      []string{},
			}, nil
		}
		return nil, fmt.Errorf("failed to list LocalQueues in namespace %q: %w", namespace, err)
	}
	queueNames := make([]string, 0, len(queues.Items))
	for _, queue := range queues.Items {
		queueNames = append(queueNames, queue.GetName())
	}

	return &models.KueueAvailability{
		Enabled:              clusterEnabled && namespaceManaged && len(queueNames) > 0,
		ClusterEnabled:       clusterEnabled,
		NamespaceManaged:     namespaceManaged,
		LocalQueuesAvailable: len(queueNames) > 0,
		LocalQueueNames:      queueNames,
	}, nil
}

func dynamicFromConfig(config *rest.Config) (dynamic.Interface, error) {
	if config == nil {
		return nil, fmt.Errorf("kubernetes REST config is unavailable")
	}
	return dynamic.NewForConfig(config)
}
