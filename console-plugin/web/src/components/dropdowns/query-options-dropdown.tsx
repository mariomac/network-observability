import { Radio, Select, Tooltip } from '@patternfly/react-core';
import { InfoAltIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Match, Reporter } from '../../model/flow-query';

export interface QueryOptionsDropdownProps {
  reporter: Reporter;
  setReporter: (reporter: Reporter) => void;
  allowReporterBoth: boolean;
  limit: number;
  setLimit: (limit: number) => void;
  match: Match;
  setMatch: (match: Match) => void;
}

type ReporterOption = { label: string; value: Reporter };

type MatchOption = { label: string; value: Match };

// Exported for tests
export const QueryOptionsPanel: React.FC<QueryOptionsDropdownProps> = ({
  reporter,
  setReporter,
  allowReporterBoth,
  limit,
  setLimit,
  match,
  setMatch
}) => {
  const { t } = useTranslation('plugin__network-observability-plugin');

  const reporterOptions: ReporterOption[] = [
    {
      label: t('Source'),
      value: 'source'
    },
    {
      label: t('Destination'),
      value: 'destination'
    },
    {
      label: t('Both'),
      value: 'both'
    }
  ];

  const matchOptions: MatchOption[] = [
    {
      label: t('Match all'),
      value: 'all'
    },
    {
      label: t('Match any'),
      value: 'any'
    }
  ];

  return (
    <>
      <div className="pf-c-select__menu-group">
        <Tooltip
          content={t(
            // eslint-disable-next-line max-len
            'Every flow can be reported from the source node and/or the destination node. For in-cluster traffic, usually both source and destination nodes report flows, resulting in duplicated data. Cluster ingress traffic is only reported by destination nodes, and cluster egress by source nodes.'
          )}
        >
          <div className="pf-c-select__menu-group-title">
            <>
              {t('Reporter node')} <InfoAltIcon />
            </>
          </div>
        </Tooltip>
        {reporterOptions.map(opt => {
          const disabled = !allowReporterBoth && opt.value === 'both';
          return (
            <div key={`reporter-${opt.value}`}>
              <label className="pf-c-select__menu-item">
                <Tooltip
                  trigger={disabled ? 'mouseenter focus' : ''}
                  content={disabled ? t('Disabled for topology view') : undefined}
                >
                  <Radio
                    isChecked={opt.value === reporter}
                    isDisabled={disabled}
                    name={`reporter-${opt.value}`}
                    onChange={() => setReporter(opt.value)}
                    label={opt.label}
                    data-test={`reporter-${opt.value}`}
                    id={`reporter-${opt.value}`}
                    value={opt.value}
                  />
                </Tooltip>
              </label>
            </div>
          );
        })}
      </div>
      <div className="pf-c-select__menu-group">
        <Tooltip
          content={t(
            // eslint-disable-next-line max-len
            'Whether each query result has to match all the filters or just any of them'
          )}
        >
          <div className="pf-c-select__menu-group-title">
            <>
              {t('Match filters')} <InfoAltIcon />
            </>
          </div>
        </Tooltip>
        {matchOptions.map(opt => (
          <div key={`match-${opt.value}`}>
            <label className="pf-c-select__menu-item">
              <Radio
                isChecked={opt.value === match}
                name={`match-${opt.value}`}
                onChange={() => setMatch(opt.value)}
                label={opt.label}
                data-test={`match-${opt.value}`}
                id={`match-${opt.value}`}
                value={opt.value}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="pf-c-select__menu-group">
        <Tooltip
          content={t(
            // eslint-disable-next-line max-len
            'Limit for internal backend queries. Depending on the matching and filter settings, several queries can be performed under the cover, each with this limit set, resulting in more results after aggregation.'
          )}
        >
          <div className="pf-c-select__menu-group-title">
            <>
              {t('Limit')} <InfoAltIcon />
            </>
          </div>
        </Tooltip>
        {[100, 500, 1000].map(l => (
          <div key={'limit-' + l}>
            <label className="pf-c-select__menu-item">
              <Radio
                data-test={'limit-' + l}
                id={'limit-' + l}
                name={'limit-' + l}
                isChecked={l === limit}
                label={String(l)}
                onChange={() => setLimit(l)}
                value={String(l)}
              />
            </label>
          </div>
        ))}
      </div>
    </>
  );
};

export const QueryOptionsDropdown: React.FC<QueryOptionsDropdownProps> = props => {
  const { t } = useTranslation('plugin__network-observability-plugin');
  const [isOpen, setOpen] = React.useState<boolean>(false);
  return (
    <div data-test="query-options-dropdown-container">
      <Select
        data-test="query-options-dropdown"
        id="query-options-dropdown"
        placeholderText={<span>{t('Query Options')}</span>}
        isOpen={isOpen}
        onToggle={() => setOpen(!isOpen)}
        customContent={<QueryOptionsPanel {...props} />}
      />
    </div>
  );
};

export default QueryOptionsDropdown;
