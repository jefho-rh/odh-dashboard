package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/julienschmidt/httprouter"
	"github.com/opendatahub-io/eval-hub/bff/internal/constants"
	"github.com/opendatahub-io/eval-hub/bff/internal/integrations/evalhub"
	kubernetes "github.com/opendatahub-io/eval-hub/bff/internal/integrations/kubernetes"
	"github.com/opendatahub-io/eval-hub/bff/internal/models"
	"k8s.io/apimachinery/pkg/api/resource"
)

type HardwareProfileValidationEnvelope Envelope[models.HardwareProfileValidationResponse, None]

func (app *App) ValidateHardwareProfileHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	ctx := r.Context()

	k8sClient, err := app.kubernetesClientFactory.GetClient(ctx)
	if err != nil {
		app.serverErrorResponse(w, r, fmt.Errorf("failed to get Kubernetes client: %w", err))
		return
	}
	evalHubClient, ok := ctx.Value(constants.EvalHubClientKey).(evalhub.EvalHubClientInterface)
	if !ok || evalHubClient == nil {
		app.serverErrorResponse(w, r, fmt.Errorf("EvalHub client not available in context"))
		return
	}
	identity, ok := ctx.Value(constants.RequestIdentityKey).(*kubernetes.RequestIdentity)
	if !ok || identity == nil {
		app.serverErrorResponse(w, r, fmt.Errorf("missing RequestIdentity in context"))
		return
	}
	namespace, _ := ctx.Value(constants.NamespaceHeaderParameterKey).(string)

	var input models.HardwareProfileValidationRequest
	if err := app.ReadJSON(w, r, &input); err != nil {
		app.badRequestResponse(w, r, err)
		return
	}
	input.HardwareProfile = strings.TrimSpace(input.HardwareProfile)
	if input.HardwareProfile == "" {
		app.badRequestResponse(w, r, fmt.Errorf("hardware_profile is required"))
		return
	}
	if len(input.ProviderIDs) == 0 {
		app.badRequestResponse(w, r, fmt.Errorf("provider_ids must contain at least one provider"))
		return
	}

	profiles, err := k8sClient.ListHardwareProfiles(ctx, identity, namespace)
	if err != nil {
		app.serverErrorResponse(w, r, fmt.Errorf("failed to validate HardwareProfile: %w", err))
		return
	}
	var profile *models.HardwareProfile
	for i := range profiles.Items {
		if profiles.Items[i].Name == input.HardwareProfile {
			profile = &profiles.Items[i]
			break
		}
	}
	if profile == nil {
		app.badRequestResponse(w, r, fmt.Errorf("HardwareProfile %q is not available in namespace %q", input.HardwareProfile, namespace))
		return
	}

	providers, err := evalHubClient.ListProviders(ctx, namespace, maxProvidersLimit, 0)
	if err != nil {
		app.evalHubErrorResponse(w, r, err, "failed to load evaluation providers for HardwareProfile validation")
		return
	}

	providerIDs := make(map[string]struct{}, len(input.ProviderIDs))
	for _, providerID := range input.ProviderIDs {
		if trimmed := strings.TrimSpace(providerID); trimmed != "" {
			providerIDs[trimmed] = struct{}{}
		}
	}
	if len(providerIDs) == 0 {
		app.badRequestResponse(w, r, fmt.Errorf("provider_ids must contain at least one non-empty provider"))
		return
	}

	result := models.HardwareProfileValidationResponse{
		Compatible:      true,
		HardwareProfile: profile.Name,
		Mismatches:      []models.HardwareProfileResourceMismatch{},
	}
	for _, provider := range providers.Items {
		resolvedProviderID := providerID(provider)
		selectedID := resolvedProviderID
		if _, selected := providerIDs[selectedID]; !selected && provider.Name != resolvedProviderID {
			if _, selectedByName := providerIDs[provider.Name]; selectedByName {
				selectedID = provider.Name
			}
		}
		if _, selected := providerIDs[selectedID]; !selected {
			continue
		}
		for _, mismatch := range validateProfileAgainstProvider(*profile, provider) {
			result.Compatible = false
			result.Mismatches = append(result.Mismatches, mismatch)
		}
		delete(providerIDs, selectedID)
		delete(providerIDs, resolvedProviderID)
		delete(providerIDs, provider.Name)
	}
	for providerID := range providerIDs {
		app.badRequestResponse(w, r, fmt.Errorf("evaluation provider %q was not found", providerID))
		return
	}

	if err := app.WriteJSON(w, http.StatusOK, HardwareProfileValidationEnvelope{Data: result}, nil); err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func validateProfileAgainstProvider(profile models.HardwareProfile, provider evalhub.Provider) []models.HardwareProfileResourceMismatch {
	if provider.Runtime == nil || provider.Runtime.K8s == nil {
		return nil
	}
	runtime := provider.Runtime.K8s
	resources := make(map[string]models.HardwareProfileResource, len(profile.Resources))
	for _, resource := range profile.Resources {
		resources[normalizeResourceName(resource.Identifier)] = resource
	}

	var mismatches []models.HardwareProfileResourceMismatch
	compare := func(resourceName, required, available string) {
		if strings.TrimSpace(required) == "" {
			return
		}
		profileResource, found := findProfileResource(resources, resourceName)
		if !found {
			mismatches = append(mismatches, models.HardwareProfileResourceMismatch{
				ProviderID: providerID(provider),
				Resource:   resourceName,
				Required:   required,
				Available:  "not configured",
				Message:    fmt.Sprintf("HardwareProfile does not provide the required %s resource", resourceName),
			})
			return
		}
		availableQuantity, availableValue := profileResourceQuantity(profileResource, resourceName)
		requiredQuantity, err := resource.ParseQuantity(required)
		if err != nil {
			mismatches = append(mismatches, models.HardwareProfileResourceMismatch{
				ProviderID: providerID(provider),
				Resource:   resourceName,
				Required:   required,
				Available:  availableValue,
				Message:    fmt.Sprintf("Evaluation provider requires an invalid %s resource quantity", resourceName),
			})
			return
		}
		if availableQuantity == nil || availableQuantity.Cmp(requiredQuantity) < 0 {
			mismatches = append(mismatches, models.HardwareProfileResourceMismatch{
				ProviderID: providerID(provider),
				Resource:   resourceName,
				Required:   required,
				Available:  availableValue,
				Message:    fmt.Sprintf("HardwareProfile provides %s %s, but the provider requires at least %s", resourceName, availableValue, required),
			})
		}
	}

	compare("cpu", runtime.CPURequest, "")
	compare("cpu_limit", runtime.CPULimit, "")
	compare("memory", runtime.MemoryRequest, "")
	compare("memory_limit", runtime.MemoryLimit, "")
	if runtime.GPU != nil && runtime.GPU.Count > 0 {
		resourceName := runtime.GPU.Resource
		if resourceName == "" {
			resourceName = "gpu"
		}
		compare(resourceName, fmt.Sprintf("%d", runtime.GPU.Count), "")
	}
	return mismatches
}

func providerID(provider evalhub.Provider) string {
	if provider.Resource.ID != "" {
		return provider.Resource.ID
	}
	return provider.Name
}

func normalizeResourceName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func findProfileResource(resources map[string]models.HardwareProfileResource, name string) (models.HardwareProfileResource, bool) {
	normalized := normalizeResourceName(name)
	if profileResource, ok := resources[normalized]; ok {
		return profileResource, true
	}
	if normalized == "cpu_limit" {
		return resources["cpu"], hasResource(resources, "cpu")
	}
	if normalized == "memory_limit" {
		return resources["memory"], hasResource(resources, "memory")
	}
	for identifier, profileResource := range resources {
		if normalized == "gpu" && (strings.Contains(identifier, "/") || strings.Contains(identifier, "gpu")) {
			return profileResource, true
		}
	}
	return models.HardwareProfileResource{}, false
}

func hasResource(resources map[string]models.HardwareProfileResource, name string) bool {
	_, ok := resources[name]
	return ok
}

func profileResourceQuantity(profileResource models.HardwareProfileResource, resourceName string) (*resource.Quantity, string) {
	value := profileResource.Default
	if strings.HasSuffix(normalizeResourceName(resourceName), "_limit") && profileResource.Maximum != "" {
		value = profileResource.Maximum
	}
	if value == "" {
		value = profileResource.Minimum
	}
	if value == "" {
		return nil, "not configured"
	}
	quantity, err := resource.ParseQuantity(value)
	if err != nil {
		return nil, value
	}
	return &quantity, value
}
