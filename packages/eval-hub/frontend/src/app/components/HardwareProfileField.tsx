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
  Skeleton,
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

type HardwareProfileFieldState = {
  unavailable: boolean;
  placeholder: string;
  helperText: string;
  helperVariant?: 'warning' | 'error';
};

const getHardwareProfileFieldState = ({
  error,
  hasNoQueues,
  hasNoProfiles,
}: {
  error?: Error;
  hasNoQueues: boolean | undefined;
  hasNoProfiles: boolean;
}): HardwareProfileFieldState => {
  switch (true) {
    case Boolean(error):
      return {
        unavailable: true,
        placeholder: 'Hardware profiles unavailable',
        helperText: error?.message ?? 'Unable to load HardwareProfiles.',
        helperVariant: 'error',
      };
    case Boolean(hasNoQueues):
      return {
        unavailable: true,
        placeholder: 'No LocalQueues available',
        helperText:
          'No LocalQueues are configured for this project. You can submit without a HardwareProfile.',
        helperVariant: 'warning',
      };
    case hasNoProfiles:
      return {
        unavailable: true,
        placeholder: 'No compatible HardwareProfiles available',
        helperText:
          'No compatible HardwareProfiles are configured for this project. You can submit without selecting one.',
        helperVariant: 'warning',
      };
    default:
      return {
        unavailable: false,
        placeholder: 'Select hardware profile',
        helperText: 'Only queue-backed HardwareProfiles are shown for this project.',
      };
  }
};

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
  const fieldState = getHardwareProfileFieldState({ error, hasNoQueues, hasNoProfiles });
  const profileSelectionDisabled = disabled || fieldState.unavailable;

  if (!loaded) {
    return (
      <FormGroup
        className="evalhub-form-group--with-description"
        label={
          <FormGroupLabel
            label="Hardware profile"
            description="Select the compute resources and queue for this evaluation."
          />
        }
        fieldId="hardware-profile"
      >
        <Skeleton
          data-testid="hardware-profile-skeleton"
          width="100%"
          height="40px"
          screenreaderText="Loading hardware profiles"
        />
      </FormGroup>
    );
  }

  if (!error && !availability?.enabled && !hasNoQueues) {
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
      <Select
        id="hardware-profile-select"
        data-testid="hardware-profile-select"
        isOpen={isOpen && !profileSelectionDisabled}
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
            isDisabled={profileSelectionDisabled}
            onClick={() => setIsOpen((open) => !open)}
            data-testid="hardware-profile-toggle"
          >
            {selected?.display_name ?? fieldState.placeholder}
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
      <FormHelperText>
        <HelperText>
          <HelperTextItem variant={fieldState.helperVariant}>
            {fieldState.helperText}
          </HelperTextItem>
        </HelperText>
      </FormHelperText>
    </FormGroup>
  );
};

export default HardwareProfileField;
