import * as React from 'react';
import { render, screen } from '@testing-library/react';
import KueueWorkloadStatusLabel from '~/app/components/KueueWorkloadStatusLabel';

describe('KueueWorkloadStatusLabel', () => {
  it('renders a spinning icon while a Workload is admitted', () => {
    render(
      <KueueWorkloadStatusLabel
        status={{
          // eslint-disable-next-line camelcase -- API payload uses OpenAPI field names.
          evaluation_id: 'evaluation-1',
          // eslint-disable-next-line camelcase -- API payload uses OpenAPI field names.
          queue_name: 'default',
          state: 'admitted',
        }}
      />,
    );

    expect(screen.getByTestId('kueue-workload-status-admitted').querySelector('svg')).toHaveClass(
      'ai-u-spin',
    );
  });
});
