import React from 'react';
import {
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  MenuToggle,
  Select,
  SelectList,
  SelectOption,
  Spinner,
} from '@patternfly/react-core';
import FormGroupLabel from '~/app/components/FormGroupLabel';
import type { HardwareProfile, KueueAvailability } from '~/app/types';

type HardwareProfileFieldProps = {
  availability?: KueueAvailability;
  profiles: HardwareProfile[];
  loaded: boolean;
  error?: Error;
  selectedProfile?: string;
  onSelect: (profile: HardwareProfile | undefined) => void;
  disabled?: boolean;
};

const formatDetails = (profile: HardwareProfile): string =>
  (profile.resources ?? [])
    .filter((resource) => resource.default)
    .map((resource) => `${resource.display_name ?? resource.identifier}: ${resource.default}`)
    .join(', ');

const HardwareProfileField: React.FC<HardwareProfileFieldProps> = ({
  availability,
  profiles,
  loaded,
  error,
  selectedProfile,
  onSelect,
  disabled,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selected = profiles.find((profile) => profile.name === selectedProfile);
  const hasNoQueues =
    availability?.cluster_enabled &&
    availability.namespace_managed &&
    !availability.local_queues_available;
  const hasNoProfiles = availability?.enabled === true && profiles.length === 0;

  if (!loaded) {
    return (
      <FormGroup label="Hardware profile" fieldId="hardware-profile">
        <Spinner size="md" aria-label="Loading hardware profiles" />
      </FormGroup>
    );
  }

  if (!availability?.enabled && !hasNoQueues) {
    return null;
  }

  return (
    <FormGroup
      className="evalhub-form-group--with-description"
      label={
        <FormGroupLabel
          label="Hardware profile"
          description="Select the compute resources and queue for this evaluation."
          isRequired={profiles.length > 0}
        />
      }
      fieldId="hardware-profile"
    >
      {profiles.length > 0 ? (
        <Select
          id="hardware-profile-select"
          data-testid="hardware-profile-select"
          isOpen={isOpen}
          selected={selectedProfile}
          onSelect={(_event, value) => {
            onSelect(profiles.find((profile) => profile.name === String(value)));
            setIsOpen(false);
          }}
          onOpenChange={setIsOpen}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              isFullWidth
              isExpanded={isOpen}
              isDisabled={disabled}
              onClick={() => setIsOpen((open) => !open)}
              data-testid="hardware-profile-toggle"
            >
              {selected?.display_name ?? 'Select hardware profile'}
            </MenuToggle>
          )}
        >
          <SelectList>
            {profiles.map((profile) => (
              <SelectOption
                key={profile.name}
                value={profile.name}
                description={formatDetails(profile)}
                isSelected={profile.name === selectedProfile}
              >
                {profile.display_name}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      ) : null}
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={error ? 'warning' : undefined}>
            {error?.message ??
              (hasNoQueues
                ? 'No LocalQueues are configured for this project. You can submit without a HardwareProfile.'
                : hasNoProfiles
                  ? 'No compatible HardwareProfiles are configured for this project. You can submit without selecting one.'
                  : 'Only queue-backed HardwareProfiles are shown for this project.')}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
};

export default HardwareProfileField;
