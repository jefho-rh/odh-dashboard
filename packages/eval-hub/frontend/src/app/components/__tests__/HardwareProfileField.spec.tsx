/* eslint-disable camelcase */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import HardwareProfileField from '~/app/components/HardwareProfileField';
import type { HardwareProfile, KueueAvailability } from '~/app/types';

const availability: KueueAvailability = {
  enabled: true,
  cluster_enabled: true,
  namespace_managed: true,
  local_queues_available: true,
  local_queue_names: ['gpu-default'],
};

const profile: HardwareProfile = {
  name: 'gpu-small',
  display_name: 'GPU Small',
  enabled: true,
  local_queue_name: 'gpu-default',
  resources: [{ identifier: 'nvidia.com/gpu', display_name: 'GPU', default: '1' }],
};

describe('HardwareProfileField', () => {
  it('shows a field skeleton while Kueue and HardwareProfiles are loading', () => {
    render(<HardwareProfileField profiles={[]} loaded={false} onSelect={jest.fn()} />);

    expect(screen.getByTestId('hardware-profile-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Hardware profile')).toBeInTheDocument();
    expect(screen.queryByTestId('hardware-profile-select')).not.toBeInTheDocument();
  });

  it('renders queue-compatible profiles and reports the selection', () => {
    const onSelect = jest.fn();
    render(
      <HardwareProfileField
        availability={availability}
        profiles={[profile]}
        loaded
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('Hardware profile')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('hardware-profile-toggle'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('GPU Small'));

    expect(onSelect).toHaveBeenCalledWith(profile);
  });

  it('stays hidden when Kueue is unavailable', () => {
    render(
      <HardwareProfileField
        availability={{ ...availability, enabled: false, namespace_managed: false }}
        profiles={[]}
        loaded
        onSelect={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('hardware-profile-select')).not.toBeInTheDocument();
  });

  it('explains when a managed namespace has no LocalQueues', () => {
    render(
      <HardwareProfileField
        availability={{
          ...availability,
          enabled: false,
          local_queues_available: false,
          local_queue_names: [],
        }}
        profiles={[]}
        loaded
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId('hardware-profile-toggle')).toBeDisabled();
    expect(screen.getByText(/No LocalQueues are configured/)).toBeInTheDocument();
  });

  it('explains when Kueue is available but no compatible profiles are configured', () => {
    render(
      <HardwareProfileField
        availability={availability}
        profiles={[]}
        loaded
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId('hardware-profile-toggle')).toBeDisabled();
    expect(screen.getByText(/No compatible HardwareProfiles are configured/)).toBeInTheDocument();
  });

  it('shows an error when loading Kueue or HardwareProfiles fails', () => {
    render(
      <HardwareProfileField
        profiles={[]}
        loaded
        error={new Error('Unable to load HardwareProfiles')}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId('hardware-profile-toggle')).toBeDisabled();
    expect(screen.getByText('Unable to load HardwareProfiles')).toBeInTheDocument();
  });
});
