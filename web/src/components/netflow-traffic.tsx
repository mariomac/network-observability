import { isModelFeatureFlag, ModelFeatureFlag, useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertActionCloseButton,
  Button,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  OverflowMenuItem,
  PageSection,
  Text,
  TextVariants,
  ToggleGroup,
  ToggleGroupItem
} from '@patternfly/react-core';
import {
  ColumnsIcon,
  ExportIcon,
  EllipsisVIcon,
  ExpandIcon,
  CompressIcon,
  SyncAltIcon,
  TableIcon,
  TopologyIcon
} from '@patternfly/react-icons';
import * as _ from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Record } from '../api/ipfix';
import { getFlows, getTopology } from '../api/routes';
import {
  Match,
  FlowQuery,
  Reporter,
  groupFiltersMatchAll,
  groupFiltersMatchAny,
  MetricFunction,
  MetricType
} from '../model/flow-query';
import { useK8sModelsWithColors } from '../utils/k8s-models-hook';
import { Stats, TopologyMetrics } from '../api/loki';
import { DefaultOptions, TopologyGroupTypes, TopologyOptions } from '../model/topology';
import { Column, getDefaultColumns } from '../utils/columns';
import { TimeRange } from '../utils/datetime';
import { getHTTPErrorDetails } from '../utils/errors';
import { DisabledFilters, Filter, hasIndexFields, getDisabledFiltersRecord, getEnabledFilters } from '../model/filters';
import {
  LOCAL_STORAGE_COLS_KEY,
  LOCAL_STORAGE_DISABLED_FILTERS_KEY,
  LOCAL_STORAGE_QUERY_PARAMS_KEY,
  LOCAL_STORAGE_REFRESH_KEY,
  LOCAL_STORAGE_SIZE_KEY,
  LOCAL_STORAGE_TOPOLOGY_OPTIONS_KEY,
  LOCAL_STORAGE_VIEW_ID_KEY,
  useLocalStorage
} from '../utils/local-storage-hook';
import { usePoll } from '../utils/poll-hook';
import {
  defaultMetricFunction,
  defaultMetricType,
  getFiltersFromURL,
  getLimitFromURL,
  getMatchFromURL,
  getRangeFromURL,
  getReporterFromURL,
  setURLFilters,
  setURLLimit,
  setURLMatch,
  setURLRange,
  setURLReporter,
  setURLMetricFunction,
  setURLMetricType
} from '../utils/router';
import DisplayDropdown, { Size } from './dropdowns/display-dropdown';
import MetricTypeDropdown from './dropdowns/metric-type-dropdown';
import MetricFunctionDropdown from './dropdowns/metric-function-dropdown';
import { RefreshDropdown } from './dropdowns/refresh-dropdown';
import TimeRangeDropdown from './dropdowns/time-range-dropdown';
import { FiltersToolbar } from './filters/filters-toolbar';
import QuerySummary from './query-summary/query-summary';
import { ColumnsModal } from './modals/columns-modal';
import { ExportModal } from './modals/export-modal';
import TimeRangeModal from './modals/time-range-modal';
import { RecordPanel } from './netflow-record/record-panel';
import NetflowTable from './netflow-table/netflow-table';
import NetflowTopology from './netflow-topology/netflow-topology';
import OptionsPanel from './netflow-topology/options-panel';
import { getURLParams, hasEmptyParams, netflowTrafficPath, removeURLParam, setURLParams, URLParam } from '../utils/url';
import { loadConfig } from '../utils/config';
import SummaryPanel from './query-summary/summary-panel';
import { GraphElement } from '@patternfly/react-topology';
import ElementPanel from './netflow-topology/element-panel';
import { ContextSingleton } from '../utils/context';

import './netflow-traffic.css';

export type ViewId = 'table' | 'topology';

// Note / improvment:
// Could also be loaded via an intermediate loader component
loadConfig();

export const NetflowTraffic: React.FC<{
  forcedFilters?: Filter[];
  isTab?: boolean;
}> = ({ forcedFilters, isTab }) => {
  const { push } = useHistory();
  const { t } = useTranslation('plugin__network-observability-plugin');
  const [extensions] = useResolvedExtensions<ModelFeatureFlag>(isModelFeatureFlag);
  const k8sModels = useK8sModelsWithColors();
  //set context from extensions. Standalone will return a "dummy" flag
  ContextSingleton.setContext(extensions);
  const [queryParams, setQueryParams] = useLocalStorage<string>(LOCAL_STORAGE_QUERY_PARAMS_KEY);
  const [disabledFilters, setDisabledFilters] = useLocalStorage<DisabledFilters>(LOCAL_STORAGE_DISABLED_FILTERS_KEY);
  // set url params from local storage saved items at startup if empty
  if (hasEmptyParams() && queryParams) {
    setURLParams(queryParams);
  }

  const warningTimeOut = React.useRef<NodeJS.Timeout | undefined>();
  const [warningMessage, setWarningMessage] = React.useState<string | undefined>();
  const [isOverflowMenuOpen, setOverflowMenuOpen] = React.useState(false);
  const [isFullScreen, setFullScreen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [flows, setFlows] = React.useState<Record[]>([]);
  const [stats, setStats] = React.useState<Stats | undefined>(undefined);
  const [topologyOptions, setTopologyOptions] = useLocalStorage<TopologyOptions>(
    LOCAL_STORAGE_TOPOLOGY_OPTIONS_KEY,
    DefaultOptions
  );
  const [metrics, setMetrics] = React.useState<TopologyMetrics[]>([]);
  const [isShowTopologyOptions, setShowTopologyOptions] = React.useState<boolean>(false);
  const [isShowQuerySummary, setShowQuerySummary] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const [size, setSize] = useLocalStorage<Size>(LOCAL_STORAGE_SIZE_KEY, 'm');
  const [isTRModalOpen, setTRModalOpen] = React.useState(false);
  const [isColModalOpen, setColModalOpen] = React.useState(false);
  const [isExportModalOpen, setExportModalOpen] = React.useState(false);
  //TODO: move default view to an Overview like dashboard instead of table
  const [selectedViewId, setSelectedViewId] = useLocalStorage<ViewId>(LOCAL_STORAGE_VIEW_ID_KEY, 'table');
  const [filters, setFilters] = React.useState<Filter[]>([]);
  const [match, setMatch] = React.useState<Match>(getMatchFromURL());
  const [reporter, setReporter] = React.useState<Reporter>(getReporterFromURL());
  const [limit, setLimit] = React.useState<number>(getLimitFromURL());
  const [range, setRange] = React.useState<number | TimeRange>(getRangeFromURL());
  const [metricFunction, setMetricFunction] = React.useState<MetricFunction>(defaultMetricFunction);
  const [metricType, setMetricType] = React.useState<MetricType | undefined>(defaultMetricType);
  const [interval, setInterval] = useLocalStorage<number | undefined>(LOCAL_STORAGE_REFRESH_KEY);
  const [selectedRecord, setSelectedRecord] = React.useState<Record | undefined>(undefined);
  const [selectedElement, setSelectedElement] = React.useState<GraphElement | undefined>(undefined);

  const isInit = React.useRef(true);
  const [columns, setColumns] = useLocalStorage<Column[]>(LOCAL_STORAGE_COLS_KEY, getDefaultColumns(t), {
    id: 'id',
    criteria: 'isSelected'
  });

  React.useEffect(() => {
    // Init state from URL
    if (!forcedFilters) {
      getFiltersFromURL(t, disabledFilters)?.then(updateTableFilters);
    }
    // disabling exhaustive-deps: tests hang when "t" passed as dependency (useTranslation not stable?)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forcedFilters]);

  const clearSelections = () => {
    setTRModalOpen(false);
    setColModalOpen(false);
    setSelectedRecord(undefined);
    setShowTopologyOptions(false);
    setShowQuerySummary(false);
    setSelectedElement(undefined);
  };

  const selectView = (view: ViewId) => {
    clearSelections();
    //reporter 'both' is disabled for topology view
    if (view === 'topology' && reporter === 'both') {
      setReporter('source');
    }
    setSelectedViewId(view);
  };

  const onRecordSelect = (record?: Record) => {
    clearSelections();
    setSelectedRecord(record);
  };

  const onElementSelect = (element?: GraphElement) => {
    clearSelections();
    setSelectedElement(element);
  };

  const onToggleTopologyOptions = (v: boolean) => {
    clearSelections();
    setShowTopologyOptions(v);
  };

  const onToggleQuerySummary = (v: boolean) => {
    clearSelections();
    setShowQuerySummary(v);
  };

  const buildFlowQuery = React.useCallback((): FlowQuery => {
    const enabledFilters = getEnabledFilters(forcedFilters || filters);
    const groupedFilters =
      match === 'any' ? groupFiltersMatchAny(enabledFilters) : groupFiltersMatchAll(enabledFilters);
    const query: FlowQuery = {
      filters: groupedFilters,
      limit: limit,
      reporter: reporter
    };
    if (range) {
      if (typeof range === 'number') {
        query.timeRange = range;
      } else if (typeof range === 'object') {
        query.startTime = range.from.toString();
        query.endTime = range.to.toString();
      }
    }
    if (selectedViewId === 'topology') {
      query.function = metricFunction;
      query.type = metricType;
      query.scope = topologyOptions.scope;
      query.groups = topologyOptions.groupTypes !== TopologyGroupTypes.NONE ? topologyOptions.groupTypes : undefined;
    }
    return query;
  }, [
    forcedFilters,
    filters,
    match,
    limit,
    reporter,
    range,
    selectedViewId,
    metricFunction,
    metricType,
    topologyOptions.scope,
    topologyOptions.groupTypes
  ]);

  const manageWarnings = React.useCallback(
    (query: Promise<unknown>) => {
      Promise.race([query, new Promise((resolve, reject) => setTimeout(reject, 2000, 'slow'))]).then(
        null,
        (reason: string) => {
          if (reason === 'slow') {
            setWarningMessage(`${t('Query is slow')}`);
          }
        }
      );
    },
    // i18n t dependency kills jest
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const tick = React.useCallback(() => {
    setLoading(true);
    setError(undefined);
    const fq = buildFlowQuery();
    switch (selectedViewId) {
      case 'table':
        manageWarnings(
          getFlows(fq)
            .then(result => {
              setFlows(result.records);
              setStats(result.stats);
            })
            .catch(err => {
              setFlows([]);
              setError(getHTTPErrorDetails(err));
              setWarningMessage(undefined);
            })
            .finally(() => {
              setLoading(false);
            })
        );
        break;
      case 'topology':
        manageWarnings(
          getTopology(fq, range)
            .then(result => {
              setMetrics(result.metrics);
              setStats(result.stats);
            })
            .catch(err => {
              setMetrics([]);
              setError(getHTTPErrorDetails(err));
              setWarningMessage(undefined);
            })
            .finally(() => {
              setLoading(false);
            })
        );
        break;
      default:
        console.error('tick called on not implemented view Id', selectedViewId);
        setLoading(false);
        break;
    }
  }, [buildFlowQuery, manageWarnings, range, selectedViewId]);

  usePoll(tick, interval);

  // tick on state change
  React.useEffect(() => {
    // Skip on init if forcedFilters not set
    if (isInit.current) {
      isInit.current = false;
      if (!forcedFilters) {
        return;
      }
    }
    tick();
  }, [forcedFilters, tick]);

  // Rewrite URL params on state change
  React.useEffect(() => {
    setURLFilters(forcedFilters || filters);
  }, [filters, forcedFilters]);
  React.useEffect(() => {
    setURLRange(range);
  }, [range]);
  React.useEffect(() => {
    setURLLimit(limit);
  }, [limit]);
  React.useEffect(() => {
    setURLMatch(match);
  }, [match]);
  React.useEffect(() => {
    setURLReporter(reporter);
  }, [reporter]);
  React.useEffect(() => {
    setURLMetricFunction(metricFunction);
    if (metricFunction === 'rate') {
      setMetricType(undefined);
    } else if (!metricType) {
      setMetricType(defaultMetricType);
    }
    setURLMetricType(metricType);
  }, [metricFunction, metricType]);

  // update local storage saved query params
  React.useEffect(() => {
    if (!forcedFilters) {
      setQueryParams(getURLParams().toString());
    }
  }, [filters, range, limit, match, reporter, metricFunction, metricType, setQueryParams, forcedFilters]);

  // update local storage enabled filters
  React.useEffect(() => {
    setDisabledFilters(getDisabledFiltersRecord(filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  //clear warning message after 10s
  React.useEffect(() => {
    if (warningTimeOut.current) {
      clearTimeout(warningTimeOut.current);
    }

    warningTimeOut.current = setTimeout(() => setWarningMessage(undefined), 10000);
  }, [warningMessage]);

  // updates table filters and clears up the table for proper visualization of the
  // updating process
  const updateTableFilters = (f: Filter[]) => {
    setFilters(f);
    setFlows([]);
    setWarningMessage(undefined);
  };

  const clearFilters = () => {
    if (forcedFilters) {
      push(netflowTrafficPath);
    } else if (filters) {
      removeURLParam(URLParam.Filters);
      updateTableFilters([]);
    }
  };

  const viewToggle = () => {
    return (
      <ToggleGroup>
        <ToggleGroupItem
          data-test="table-view-button"
          icon={<TableIcon />}
          text={t('Flow Table')}
          buttonId="tableViewButton"
          isSelected={selectedViewId === 'table'}
          onChange={() => selectView('table')}
        />
        <ToggleGroupItem
          data-test="topology-view-button"
          icon={<TopologyIcon />}
          text={t('Topology')}
          buttonId="topologyViewButton"
          isSelected={selectedViewId === 'topology'}
          onChange={() => selectView('topology')}
        />
      </ToggleGroup>
    );
  };

  const actions = () => {
    return (
      <div className="co-actions">
        {selectedViewId === 'topology' && (
          <MetricFunctionDropdown
            data-test="metricFunction"
            id="metricFunction"
            selected={metricFunction}
            setMetricFunction={setMetricFunction}
          />
        )}
        {selectedViewId === 'topology' && metricFunction !== 'rate' && (
          <MetricTypeDropdown
            data-test="metricType"
            id="metricType"
            selected={metricType}
            setMetricType={setMetricType}
          />
        )}
        <TimeRangeDropdown
          data-test="time-range-dropdown"
          id="time-range-dropdown"
          range={range}
          setRange={setRange}
          openCustomModal={() => setTRModalOpen(true)}
        />
        <RefreshDropdown
          data-test="refresh-dropdown"
          id="refresh-dropdown"
          disabled={typeof range !== 'number'}
          interval={interval}
          setInterval={setInterval}
        />
        <Button
          data-test="refresh-button"
          id="refresh-button"
          className="co-action-refresh-button"
          variant="primary"
          onClick={() => tick()}
          icon={<SyncAltIcon style={{ animation: `spin ${loading ? 1 : 0}s linear infinite` }} />}
        />
      </div>
    );
  };

  const menuContent = () => {
    const items: JSX.Element[] = [];

    const viewToggleElement = viewToggle();
    if (!_.isEmpty(forcedFilters) && viewToggleElement) {
      items.push(<OverflowMenuItem isPersistent>{viewToggleElement}</OverflowMenuItem>);
    }

    if (selectedViewId === 'table') {
      items.push(
        <OverflowMenuItem isPersistent key="columns">
          <Button
            data-test="manage-columns-button"
            id="manage-columns-button"
            variant="link"
            className="overflow-button"
            icon={<ColumnsIcon />}
            onClick={() => setColModalOpen(true)}
          >
            {t('Manage columns')}
          </Button>
        </OverflowMenuItem>
      );
      items.push(
        <OverflowMenuItem key="display">
          <DisplayDropdown data-test="display" id="display" setSize={setSize} />
        </OverflowMenuItem>
      );
      items.push(
        <OverflowMenuItem key="export">
          <Button
            data-test="export-button"
            id="export-button"
            variant="link"
            className="overflow-button"
            icon={<ExportIcon />}
            onClick={() => setExportModalOpen(true)}
          >
            {t('Export')}
          </Button>
        </OverflowMenuItem>
      );
    }

    items.push(
      <OverflowMenuItem key="fullscreen" isPersistent={selectedViewId === 'topology'}>
        <Button
          data-test="fullscreen-button"
          id="fullscreen-button"
          variant="link"
          className="overflow-button"
          icon={isFullScreen ? <CompressIcon /> : <ExpandIcon />}
          onClick={() => setFullScreen(!isFullScreen)}
        >
          {isFullScreen ? t('Collapse') : t('Expand')}
        </Button>
      </OverflowMenuItem>
    );
    return items;
  };

  const menuControl = () => {
    if (selectedViewId !== 'table') {
      return undefined;
    }
    return (
      <Dropdown
        data-test="more-options-dropdown"
        id="more-options-dropdown"
        onSelect={() => setOverflowMenuOpen(false)}
        toggle={
          <Button
            data-test="more-options-button"
            id="more-options-button"
            variant="link"
            className="overflow-button"
            icon={<EllipsisVIcon />}
            onClick={() => setOverflowMenuOpen(!isOverflowMenuOpen)}
          >
            {t('More options')}
          </Button>
        }
        isOpen={isOverflowMenuOpen}
        dropdownItems={[
          <DropdownGroup key="display-group" label={t('Display')}>
            <DropdownItem key="s" onClick={() => setSize('s')}>
              {t('Compact')}
            </DropdownItem>
            <DropdownItem key="m" onClick={() => setSize('m')}>
              {t('Normal')}
            </DropdownItem>
            <DropdownItem key="l" onClick={() => setSize('l')}>
              {t('Large')}
            </DropdownItem>
          </DropdownGroup>,
          <DropdownGroup key="export-group" label={t('Actions')}>
            <DropdownItem key="export" onClick={() => setExportModalOpen(true)}>
              {t('Export')}
            </DropdownItem>
          </DropdownGroup>,
          <DropdownGroup key="fullscreen-group" label={t('View')}>
            <DropdownItem key="fullscreen" onClick={() => setFullScreen(!isFullScreen)}>
              {isFullScreen ? t('Collapse') : t('Expand')}
            </DropdownItem>
          </DropdownGroup>
        ]}
      />
    );
  };

  const panelContent = () => {
    if (selectedRecord) {
      return (
        <RecordPanel
          id="recordPanel"
          record={selectedRecord}
          columns={getDefaultColumns(t, false, false)}
          filters={filters}
          range={range}
          reporter={reporter}
          setFilters={setFilters}
          setRange={setRange}
          setReporter={setReporter}
          onClose={() => onRecordSelect(undefined)}
        />
      );
    } else if (isShowTopologyOptions) {
      return (
        <OptionsPanel
          id="optionsPanel"
          options={topologyOptions}
          setOptions={setTopologyOptions}
          onClose={() => setShowTopologyOptions(false)}
        />
      );
    } else if (isShowQuerySummary) {
      return (
        <SummaryPanel
          id="summaryPanel"
          flows={flows}
          stats={stats}
          range={range}
          onClose={() => setShowQuerySummary(false)}
        />
      );
    } else if (selectedElement) {
      return (
        <ElementPanel
          id="elementPanel"
          element={selectedElement}
          metrics={metrics}
          metricFunction={metricFunction}
          metricType={metricType}
          options={topologyOptions}
          filters={filters}
          setFilters={setFilters}
          onClose={() => onElementSelect(undefined)}
        />
      );
    } else {
      return null;
    }
  };

  const pageContent = () => {
    switch (selectedViewId) {
      case 'table':
        return (
          <NetflowTable
            loading={loading}
            error={error}
            flows={flows}
            selectedRecord={selectedRecord}
            size={size}
            onSelect={onRecordSelect}
            clearFilters={clearFilters}
            columns={columns.filter(col => col.isSelected)}
          />
        );
      case 'topology':
        return (
          <NetflowTopology
            loading={loading}
            k8sModels={k8sModels}
            error={error}
            range={range}
            metricFunction={metricFunction}
            metricType={metricType}
            metrics={metrics}
            options={topologyOptions}
            setOptions={setTopologyOptions}
            filters={filters}
            setFilters={setFilters}
            toggleTopologyOptions={() => onToggleTopologyOptions(!isShowTopologyOptions)}
            selected={selectedElement}
            onSelect={onElementSelect}
          />
        );
      default:
        return null;
    }
  };

  //update data on filters changes
  React.useEffect(() => {
    setTRModalOpen(false);
  }, [range]);

  //update page on full screen change
  React.useEffect(() => {
    const header = document.getElementById('page-main-header');
    const sideBar = document.getElementById('page-sidebar');
    const notification = document.getElementsByClassName('co-global-notifications');
    [header, sideBar, ...notification].forEach(e => {
      if (isFullScreen) {
        e?.classList.add('hidden');
      } else {
        e?.classList.remove('hidden');
      }
    });
  }, [isFullScreen]);

  return !_.isEmpty(extensions) ? (
    <PageSection id="pageSection" className={isTab ? 'tab' : ''}>
      {
        //display title only if forced filters is not set
        _.isEmpty(forcedFilters) && (
          <div id="pageHeader">
            <div className="flex">
              <Text component={TextVariants.h1}>{t('Network Traffic')}</Text>
            </div>
            {viewToggle()}
          </div>
        )
      }
      <FiltersToolbar
        id="filter-toolbar"
        filters={filters}
        setFilters={updateTableFilters}
        clearFilters={clearFilters}
        queryOptionsProps={{
          limit,
          setLimit,
          match,
          setMatch,
          reporter,
          setReporter,
          allowReporterBoth: selectedViewId === 'table'
        }}
        forcedFilters={forcedFilters}
        actions={actions()}
        menuContent={menuContent()}
        menuControl={menuControl()}
      />
      <Drawer
        id="drawer"
        isInline
        isExpanded={
          selectedRecord !== undefined || selectedElement !== undefined || isShowTopologyOptions || isShowQuerySummary
        }
      >
        <DrawerContent id="drawerContent" panelContent={panelContent()}>
          <DrawerContentBody id="drawerBody">{pageContent()}</DrawerContentBody>
        </DrawerContent>
      </Drawer>
      <QuerySummary
        flows={flows}
        range={range}
        stats={stats}
        toggleQuerySummary={() => onToggleQuerySummary(!isShowQuerySummary)}
      />
      <TimeRangeModal
        id="time-range-modal"
        isModalOpen={isTRModalOpen}
        setModalOpen={setTRModalOpen}
        range={typeof range === 'object' ? range : undefined}
        setRange={setRange}
      />
      <ColumnsModal
        id="columns-modal"
        isModalOpen={isColModalOpen}
        setModalOpen={setColModalOpen}
        columns={columns}
        setColumns={setColumns}
      />
      <ExportModal
        id="export-modal"
        isModalOpen={isExportModalOpen}
        setModalOpen={setExportModalOpen}
        flowQuery={buildFlowQuery()}
        columns={columns.filter(c => c.fieldName)}
        range={range}
        filters={forcedFilters ? forcedFilters : filters}
      />
      {!_.isEmpty(warningMessage) && (
        <Alert
          id="netflow-warning"
          title={warningMessage}
          variant="warning"
          actionClose={<AlertActionCloseButton onClose={() => setWarningMessage(undefined)} />}
        >
          {hasIndexFields(filters)
            ? t('Add more filters or decrease limit / range to improve the query performance')
            : t('Add Namespace, Owner or Resource filters (which use indexed fields) to improve the query performance')}
        </Alert>
      )}
    </PageSection>
  ) : null;
};

export default NetflowTraffic;
