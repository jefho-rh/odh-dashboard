package kubernetes

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/opendatahub-io/eval-hub/bff/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

const (
	hardwareProfileGroup    = "infrastructure.opendatahub.io"
	hardwareProfileVersion  = "v1"
	hardwareProfileResource = "hardwareprofiles"
)

var hardwareProfileGVR = schema.GroupVersionResource{
	Group:    hardwareProfileGroup,
	Version:  hardwareProfileVersion,
	Resource: hardwareProfileResource,
}

func listHardwareProfiles(
	ctx context.Context,
	client dynamic.Interface,
	namespace string,
) (*models.HardwareProfilesResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	availability, err := getKueueAvailability(ctx, client, namespace)
	if err != nil {
		return nil, err
	}
	if !availability.Enabled {
		warning := ""
		if availability.ClusterEnabled && availability.NamespaceManaged {
			warning = "No LocalQueues are configured for this namespace."
		}
		return &models.HardwareProfilesResponse{
			Items:   []models.HardwareProfile{},
			Warning: warning,
		}, nil
	}

	queues := make(map[string]struct{}, len(availability.LocalQueueNames))
	for _, name := range availability.LocalQueueNames {
		queues[name] = struct{}{}
	}

	profiles, err := client.Resource(hardwareProfileGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list HardwareProfiles in namespace %q: %w", namespace, err)
	}

	items := make([]models.HardwareProfile, 0, len(profiles.Items))
	for _, profile := range profiles.Items {
		if profile.GetAnnotations()["opendatahub.io/disabled"] == "true" {
			continue
		}

		enabled, found, _ := unstructured.NestedBool(profile.Object, "spec", "enabled")
		if found && !enabled {
			continue
		}

		scheduling, _, _ := unstructured.NestedMap(profile.Object, "spec", "scheduling")
		schedulingType, _, _ := unstructured.NestedString(scheduling, "type")
		kueue, _, _ := unstructured.NestedMap(scheduling, "kueue")
		localQueueName, _, _ := unstructured.NestedString(kueue, "localQueueName")

		if schedulingType != "Queue" || localQueueName == "" {
			continue
		}
		if _, ok := queues[localQueueName]; !ok {
			continue
		}

		resources := make([]models.HardwareProfileResource, 0)
		identifiers, _, _ := unstructured.NestedSlice(profile.Object, "spec", "identifiers")
		for _, raw := range identifiers {
			identifier, ok := raw.(map[string]interface{})
			if !ok {
				continue
			}
			resources = append(resources, models.HardwareProfileResource{
				DisplayName:  stringField(identifier, "displayName"),
				Identifier:   stringField(identifier, "identifier"),
				ResourceType: stringField(identifier, "resourceType"),
				Default:      stringFieldAny(identifier, "defaultCount"),
				Minimum:      stringFieldAny(identifier, "minCount"),
				Maximum:      stringFieldAny(identifier, "maxCount"),
			})
		}

		annotations := profile.GetAnnotations()
		items = append(items, models.HardwareProfile{
			Name:           profile.GetName(),
			DisplayName:    firstNonEmpty(annotations["opendatahub.io/display-name"], profile.GetName()),
			Description:    annotations["opendatahub.io/description"],
			Enabled:        true,
			SchedulingType: schedulingType,
			LocalQueueName: localQueueName,
			PriorityClass:  stringField(kueue, "priorityClass"),
			Resources:      resources,
		})
	}

	return &models.HardwareProfilesResponse{Items: items}, nil
}

func stringField(values map[string]interface{}, key string) string {
	value, _ := values[key].(string)
	return value
}

func stringFieldAny(values map[string]interface{}, key string) string {
	value := values[key]
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
