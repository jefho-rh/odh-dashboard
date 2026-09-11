import React from 'react';
import { FetchStateCallbackPromise, NotReadyError, useFetchState } from 'mod-arch-core';
import { getHardwareProfiles, getKueueAvailability } from '~/app/api/k8s';
import type { HardwareProfile, KueueAvailability } from '~/app/types';

type UseHardwareProfilesResult = {
  availability: KueueAvailability | undefined;
  profiles: HardwareProfile[];
  loaded: boolean;
  error: Error | undefined;
};

export const useHardwareProfiles = (namespace: string | undefined): UseHardwareProfilesResult => {
  const callback = React.useCallback<
    FetchStateCallbackPromise<{ availability: KueueAvailability; profiles: HardwareProfile[] }>
  >(
    async (opts) => {
      if (!namespace) {
        throw new NotReadyError('Namespace is required to load HardwareProfiles');
      }
      const [availability, profiles] = await Promise.all([
        getKueueAvailability('', namespace)(opts),
        getHardwareProfiles('', namespace)(opts),
      ]);
      return { availability, profiles };
    },
    [namespace],
  );

  const [data, loaded, error] = useFetchState<{
    availability: KueueAvailability | undefined;
    profiles: HardwareProfile[];
  }>(
    callback,
    {
      availability: undefined,
      profiles: [],
    },
    { initialPromisePurity: true },
  );

  return {
    availability: data.availability,
    profiles: data.profiles,
    loaded,
    error,
  };
};
