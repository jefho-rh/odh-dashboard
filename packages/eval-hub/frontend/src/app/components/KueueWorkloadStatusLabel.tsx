import * as React from 'react';
import { Label, LabelProps, Tooltip } from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InProgressIcon,
  PendingIcon,
} from '@patternfly/react-icons';
import type { KueueWorkloadState, KueueWorkloadStatus } from '~/app/types';

type StatusConfig = {
  label: string;
  color?: LabelProps['color'];
  status?: LabelProps['status'];
  icon: React.ReactNode;
  isFilled?: boolean;
};

const statusMap: Record<KueueWorkloadState, StatusConfig> = {
  queued: {
    label: 'Queued',
    color: 'purple',
    icon: <PendingIcon />,
  },
  admitted: {
    label: 'Admitted',
    color: 'blue',
    icon: <InProgressIcon className="ai-u-spin" />,
  },
  finished: {
    label: 'Finished',
    status: 'success',
    icon: <CheckCircleIcon />,
    isFilled: true,
  },
  preempted: {
    label: 'Preempted',
    status: 'warning',
    icon: <ExclamationTriangleIcon />,
  },
};

type KueueWorkloadStatusLabelProps = {
  status: KueueWorkloadStatus;
};

const KueueWorkloadStatusLabel: React.FC<KueueWorkloadStatusLabelProps> = ({ status }) => {
  const config = statusMap[status.state];
  const details = (
    <>
      <div>LocalQueue: {status.queue_name}</div>
      {status.message ? <div>{status.message}</div> : null}
    </>
  );

  return (
    <Tooltip content={details}>
      <span>
        <Label
          variant={config.isFilled ? 'filled' : 'outline'}
          color={config.color}
          status={config.status}
          icon={config.icon}
          data-testid={`kueue-workload-status-${status.state}`}
        >
          {config.label}
        </Label>
      </span>
    </Tooltip>
  );
};

export default KueueWorkloadStatusLabel;
