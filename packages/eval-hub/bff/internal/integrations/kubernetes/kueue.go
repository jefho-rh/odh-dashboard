package kubernetes

import (
	"context"
	"fmt"
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
)

var (
	dscGVR        = schema.GroupVersionResource{Group: dscGroup, Version: dscVersion, Resource: dscResource}
	localQueueGVR = schema.GroupVersionResource{Group: kueueGroup, Version: kueueVersion, Resource: localQueueResource}
)

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
	if err == nil && len(dscList.Items) > 0 {
		components, _, _ := unstructured.NestedMap(dscList.Items[0].Object, "spec", "components")
		kueue, _, _ := unstructured.NestedMap(components, "kueue")
		managementState, _, _ := unstructured.NestedString(kueue, "managementState")
		clusterEnabled = managementState == "Managed"
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
		return nil, fmt.Errorf("Kubernetes REST config is unavailable")
	}
	return dynamic.NewForConfig(config)
}
