package kubernetes

import (
	"context"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestListHardwareProfilesReturnsOnlyQueueCompatibleProfiles(t *testing.T) {
	client := newKueueFakeClient(
		namespaceObject(map[string]interface{}{kueueManagedLabel: "true"}),
		managedDataScienceCluster(),
		localQueue("gpu-default"),
		hardwareProfile("gpu-small", "GPU Small", true, "Queue", "gpu-default", nil),
		hardwareProfile("missing-queue", "Missing Queue", true, "Queue", "does-not-exist", nil),
		hardwareProfile("direct", "Direct", true, "Direct", "", nil),
		hardwareProfile("disabled", "Disabled", true, "Queue", "gpu-default", map[string]interface{}{
			"opendatahub.io/disabled": "true",
		}),
		hardwareProfile("spec-disabled", "Spec Disabled", false, "Queue", "gpu-default", nil),
	)

	response, err := listHardwareProfiles(context.Background(), client, testNamespace)
	if err != nil {
		t.Fatalf("listHardwareProfiles() error = %v", err)
	}

	if len(response.Items) != 1 {
		t.Fatalf("listHardwareProfiles() returned %d items, want 1: %+v", len(response.Items), response.Items)
	}
	if response.Items[0].Name != "gpu-small" {
		t.Fatalf("listHardwareProfiles() returned %q, want gpu-small", response.Items[0].Name)
	}
}

func TestListHardwareProfilesWarnsWhenNoLocalQueuesExist(t *testing.T) {
	client := newKueueFakeClient(
		namespaceObject(map[string]interface{}{kueueManagedLabel: "true"}),
		managedDataScienceCluster(),
	)

	response, err := listHardwareProfiles(context.Background(), client, testNamespace)
	if err != nil {
		t.Fatalf("listHardwareProfiles() error = %v", err)
	}
	if len(response.Items) != 0 {
		t.Fatalf("listHardwareProfiles() returned items = %+v, want none", response.Items)
	}
	if response.Warning == "" {
		t.Fatal("listHardwareProfiles() warning is empty, want LocalQueue warning")
	}
}

func hardwareProfile(
	name string,
	displayName string,
	enabled bool,
	schedulingType string,
	localQueueName string,
	annotations map[string]interface{},
) *unstructured.Unstructured {
	metadata := map[string]interface{}{
		"name":      name,
		"namespace": testNamespace,
	}
	if annotations != nil {
		metadata["annotations"] = annotations
	}
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "infrastructure.opendatahub.io/v1",
		"kind":       "HardwareProfile",
		"metadata":   metadata,
		"spec": map[string]interface{}{
			"enabled": enabled,
			"scheduling": map[string]interface{}{
				"type": schedulingType,
				"kueue": map[string]interface{}{
					"localQueueName": localQueueName,
				},
			},
			"identifiers": []interface{}{
				map[string]interface{}{
					"identifier":   "cpu",
					"displayName":  displayName,
					"defaultCount": int64(1),
				},
			},
		},
	}}
}
