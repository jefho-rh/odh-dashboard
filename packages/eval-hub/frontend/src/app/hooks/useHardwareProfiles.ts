import { useQuery } from '@tanstack/react-query';
import { getHardwareProfiles, getKueueAvailability } from '~/app/api/k8s';
import type { HardwareProfile, KueueAvailability } from '~/app/types';

type UseHardwareProfilesResult = {
  availability: KueueAvailability | undefined;
  profiles: HardwareProfile[];
  loaded: boolean;
  error: Error | undefined;
};

export const useHardwareProfiles = (namespace: string | undefined): UseHardwareProfilesResult => {
  const query = useQuery({
    queryKey: ['evalHubHardwareProfiles', namespace],
    enabled: Boolean(namespace),
    queryFn: async ({ signal }) => {
      if (!namespace) {
        throw new Error('Namespace is required to load HardwareProfiles');
      }
      const [availability, profiles] = await Promise.all([
        getKueueAvailability('', namespace)({ signal }),
        getHardwareProfiles('', namespace)({ signal }),
      ]);
      return { availability, profiles };
    },
  });

  return {
    availability: query.data?.availability,
    profiles: query.data?.profiles ?? [],
    loaded: query.isSuccess || query.isError,
    error: query.error ?? undefined,
  };
};
