package kubernetes

import (
	"context"
	"errors"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"
)

const testNamespace = "evalhub-test"

func TestGetKueueAvailability(t *testing.T) {
	tests := []struct {
		name                 string
		namespaceLabels      map[string]interface{}
		dataScienceCluster   *unstructured.Unstructured
		localQueues          []*unstructured.Unstructured
		wantEnabled          bool
		wantClusterEnabled   bool
		wantNamespaceManaged bool
		wantQueueNames       []string
	}{
		{
			name: "enabled when cluster and namespace are managed and a LocalQueue exists",
			namespaceLabels: map[string]interface{}{
				kueueManagedLabel: "true",
			},
			dataScienceCluster: managedDataScienceCluster(),
			localQueues: []*unstructured.Unstructured{
				localQueue("gpu-default"),
			},
			wantEnabled:          true,
			wantClusterEnabled:   true,
			wantNamespaceManaged: true,
			wantQueueNames:       []string{"gpu-default"},
		},
		{
			name:               "disabled when the namespace is not managed",
			namespaceLabels:    map[string]interface{}{},
			dataScienceCluster: managedDataScienceCluster(),
			wantClusterEnabled: true,
			wantQueueNames:     []string{},
		},
		{
			name: "disabled when no LocalQueues exist",
			namespaceLabels: map[string]interface{}{
				kueueManagedLabel: "true",
			},
			dataScienceCluster:   managedDataScienceCluster(),
			wantClusterEnabled:   true,
			wantNamespaceManaged: true,
			wantQueueNames:       []string{},
		},
		{
			name: "disabled when Kueue is not managed in the DataScienceCluster",
			namespaceLabels: map[string]interface{}{
				kueueManagedLabel: "true",
			},
			dataScienceCluster:   unmanagedDataScienceCluster(),
			wantNamespaceManaged: true,
			wantQueueNames:       []string{},
		},
		{
			name: "disabled when no DataScienceCluster exists",
			namespaceLabels: map[string]interface{}{
				kueueManagedLabel: "true",
			},
			wantNamespaceManaged: true,
			wantQueueNames:       []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			objects := []runtime.Object{namespaceObject(tt.namespaceLabels)}
			if tt.dataScienceCluster != nil {
				objects = append(objects, tt.dataScienceCluster)
			}
			for _, queue := range tt.localQueues {
				objects = append(objects, queue)
			}

			client := newKueueFakeClient(objects...)
			availability, err := getKueueAvailability(context.Background(), client, testNamespace)
			if err != nil {
				t.Fatalf("getKueueAvailability() error = %v", err)
			}

			if availability.Enabled != tt.wantEnabled {
				t.Errorf("Enabled = %t, want %t", availability.Enabled, tt.wantEnabled)
			}
			if availability.ClusterEnabled != tt.wantClusterEnabled {
				t.Errorf("ClusterEnabled = %t, want %t", availability.ClusterEnabled, tt.wantClusterEnabled)
			}
			if availability.NamespaceManaged != tt.wantNamespaceManaged {
				t.Errorf("NamespaceManaged = %t, want %t", availability.NamespaceManaged, tt.wantNamespaceManaged)
			}
			if len(availability.LocalQueueNames) != len(tt.wantQueueNames) {
				t.Fatalf("LocalQueueNames = %v, want %v", availability.LocalQueueNames, tt.wantQueueNames)
			}
			for i, name := range tt.wantQueueNames {
				if availability.LocalQueueNames[i] != name {
					t.Errorf("LocalQueueNames[%d] = %q, want %q", i, availability.LocalQueueNames[i], name)
				}
			}
		})
	}
}

func TestGetKueueAvailabilityReturnsDataScienceClusterListError(t *testing.T) {
	client := newKueueFakeClient(namespaceObject(map[string]interface{}{
		kueueManagedLabel: "true",
	}))
	client.PrependReactor("list", dscResource, func(action k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("permission denied")
	})

	if _, err := getKueueAvailability(context.Background(), client, testNamespace); err == nil {
		t.Fatal("getKueueAvailability() error = nil, want DataScienceCluster list error")
	}
}

func newKueueFakeClient(objects ...runtime.Object) *dynamicfake.FakeDynamicClient {
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(
		runtime.NewScheme(),
		map[schema.GroupVersionResource]string{
			{Version: "v1", Resource: "namespaces"}: "NamespaceList",
			dscGVR:                                  "DataScienceClusterList",
			localQueueGVR:                           "LocalQueueList",
			hardwareProfileGVR:                      "HardwareProfileList",
		},
		objects...,
	)
}

func namespaceObject(labels map[string]interface{}) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Namespace",
		"metadata": map[string]interface{}{
			"name":   testNamespace,
			"labels": labels,
		},
	}}
}

func managedDataScienceCluster() *unstructured.Unstructured {
	return dataScienceCluster("Managed")
}

func unmanagedDataScienceCluster() *unstructured.Unstructured {
	return dataScienceCluster("Removed")
}

func dataScienceCluster(managementState string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "datasciencecluster.opendatahub.io/v2",
		"kind":       "DataScienceCluster",
		"metadata": map[string]interface{}{
			"name": "default-dsc",
		},
		"spec": map[string]interface{}{
			"components": map[string]interface{}{
				"kueue": map[string]interface{}{
					"managementState": managementState,
				},
			},
		},
	}}
}

func localQueue(name string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "kueue.x-k8s.io/v1beta2",
		"kind":       "LocalQueue",
		"metadata": map[string]interface{}{
			"name":      name,
			"namespace": testNamespace,
		},
	}}
}
