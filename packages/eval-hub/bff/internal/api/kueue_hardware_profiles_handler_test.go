package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/opendatahub-io/eval-hub/bff/internal/integrations/evalhub"
	kubernetes "github.com/opendatahub-io/eval-hub/bff/internal/integrations/kubernetes"
	"github.com/opendatahub-io/eval-hub/bff/internal/models"
)

type kueueHardwareProfilesK8sClient struct {
	testK8sClient
	availability *models.KueueAvailability
	profiles     *models.HardwareProfilesResponse
	missingQueue string
	queueMissing bool
	err          error
}

func (c *kueueHardwareProfilesK8sClient) GetKueueAvailability(_ context.Context, _ *kubernetes.RequestIdentity, _ string) (*models.KueueAvailability, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.availability, nil
}

func (c *kueueHardwareProfilesK8sClient) ListHardwareProfiles(_ context.Context, _ *kubernetes.RequestIdentity, _ string) (*models.HardwareProfilesResponse, error) {
	if c.err != nil {
		return nil, c.err
	}
	return c.profiles, nil
}

func (c *kueueHardwareProfilesK8sClient) GetMissingHardwareProfileLocalQueueName(_ context.Context, _ *kubernetes.RequestIdentity, _, _ string) (string, bool, error) {
	return c.missingQueue, c.queueMissing, c.err
}

func TestKueueAvailabilityHandlerReturnsAvailability(t *testing.T) {
	client := &kueueHardwareProfilesK8sClient{
		availability: &models.KueueAvailability{
			Enabled:              true,
			ClusterEnabled:       true,
			NamespaceManaged:     true,
			LocalQueuesAvailable: true,
			LocalQueueNames:      []string{"gpu-default"},
		},
	}
	result, response, err := setupApiTestWithEvalHub[KueueAvailabilityEnvelope](
		http.MethodGet,
		"/eval-hub/api/v1/kueue/availability?namespace=test-namespace",
		nil,
		&crStatusK8sFactory{client: client},
		&kubernetes.RequestIdentity{UserID: "test-user"},
		nil,
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if !result.Data.Enabled || result.Data.LocalQueueNames[0] != "gpu-default" {
		t.Fatalf("unexpected availability response: %+v", result.Data)
	}
}

func TestHardwareProfilesHandlerReturnsProfiles(t *testing.T) {
	client := &kueueHardwareProfilesK8sClient{profiles: &models.HardwareProfilesResponse{
		Items: []models.HardwareProfile{{
			Name:           "gpu",
			DisplayName:    "GPU",
			Enabled:        true,
			SchedulingType: "Queue",
			LocalQueueName: "gpu-default",
		}},
	}}
	result, response, err := setupApiTestWithEvalHub[HardwareProfilesEnvelope](
		http.MethodGet,
		"/eval-hub/api/v1/hardwareprofiles?namespace=test-namespace",
		nil,
		&crStatusK8sFactory{client: client},
		&kubernetes.RequestIdentity{UserID: "test-user"},
		nil,
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusOK)
	}
	if len(result.Data.Items) != 1 || result.Data.Items[0].LocalQueueName != "gpu-default" {
		t.Fatalf("unexpected HardwareProfiles response: %+v", result.Data)
	}
}

func TestValidateHardwareProfileHandlerReportsDeletedLocalQueue(t *testing.T) {
	client := &kueueHardwareProfilesK8sClient{
		profiles:     &models.HardwareProfilesResponse{},
		missingQueue: "gpu-default",
		queueMissing: true,
	}
	result, response, err := setupApiTestWithEvalHub[HTTPError](
		http.MethodPost,
		"/eval-hub/api/v1/hardwareprofiles/validate?namespace=test-namespace",
		models.HardwareProfileValidationRequest{HardwareProfile: "gpu", ProviderIDs: []string{"provider"}},
		&crStatusK8sFactory{client: client},
		&kubernetes.RequestIdentity{UserID: "test-user"},
		nil,
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}
	if result.Error.Message != "LocalQueue \"gpu-default\" configured by HardwareProfile \"gpu\" is no longer available in namespace \"test-namespace\"" {
		t.Fatalf("unexpected error response: %+v", result)
	}
}

type paginatedProvidersClient struct {
	erroringEHClient
	pages map[int]evalhub.ProvidersResponse
	calls []int
}

func (c *paginatedProvidersClient) ListProviders(_ context.Context, _ string, limit, offset int) (evalhub.ProvidersResponse, error) {
	if limit != maxProvidersLimit {
		return evalhub.ProvidersResponse{}, fmt.Errorf("limit = %d, want %d", limit, maxProvidersLimit)
	}
	c.calls = append(c.calls, offset)
	return c.pages[offset], nil
}

func TestListSelectedProvidersFollowsPagination(t *testing.T) {
	firstPage := make([]evalhub.Provider, maxProvidersLimit)
	for i := range firstPage {
		firstPage[i] = evalhub.Provider{Resource: evalhub.ProviderResource{ID: fmt.Sprintf("provider-%d", i)}}
	}
	client := &paginatedProvidersClient{pages: map[int]evalhub.ProvidersResponse{
		0: {Items: firstPage, TotalCount: maxProvidersLimit + 1},
		maxProvidersLimit: {Items: []evalhub.Provider{{
			Resource: evalhub.ProviderResource{ID: "target-provider"},
			Name:     "target-provider",
		}}, TotalCount: maxProvidersLimit + 1},
	}}

	providers, missing, err := listSelectedProviders(
		context.Background(),
		client,
		"test-namespace",
		map[string]struct{}{"target-provider": {}},
	)
	if err != nil {
		t.Fatalf("listSelectedProviders() error = %v", err)
	}
	if len(missing) != 0 || len(providers) != 1 || providers[0].Resource.ID != "target-provider" {
		t.Fatalf("unexpected selected providers: providers=%+v missing=%v", providers, missing)
	}
	if len(client.calls) != 2 || client.calls[1] != maxProvidersLimit {
		t.Fatalf("provider page offsets = %v, want [0 %d]", client.calls, maxProvidersLimit)
	}
}
