import { SortByDirection, TableComposable, Tbody, Th, Thead, Tr } from '@patternfly/react-table';
import { mount } from 'enzyme';
import * as React from 'react';
import { Column, ColumnsId } from '../../../utils/columns';
import { AllSelectedColumns, DefaultColumns, filterOrderedColumnsByIds } from '../../__tests-data__/columns';
import { NetflowTableHeader } from '../netflow-table-header';

const NetflowTableHeaderWrapper: React.FC<{
  onSort: (id: ColumnsId, direction: SortByDirection) => void;
  sortId: ColumnsId;
  sortDirection: SortByDirection;
  columns: Column[];
}> = ({ onSort, sortId, sortDirection, columns }) => {
  return (
    <TableComposable aria-label="Misc table" variant="compact">
      <NetflowTableHeader
        onSort={onSort}
        sortDirection={sortDirection}
        sortId={sortId}
        columns={columns}
        tableWidth={100}
      />
      <Tbody></Tbody>
    </TableComposable>
  );
};

describe('<NetflowTableHeader />', () => {
  const mocks = {
    onSort: jest.fn(),
    sortId: ColumnsId.endtime,
    sortDirection: SortByDirection.asc,
    tableWidth: 100
  };
  it('should render component', async () => {
    const wrapper = mount(<NetflowTableHeaderWrapper {...mocks} columns={AllSelectedColumns} />);
    expect(wrapper.find(NetflowTableHeader)).toBeTruthy();
    expect(wrapper.find(Thead)).toHaveLength(1);
    expect(wrapper.find(Th).length).toBeGreaterThanOrEqual(AllSelectedColumns.length);
  });
  it('should render given columns', async () => {
    const wrapper = mount(
      <NetflowTableHeaderWrapper {...mocks} columns={filterOrderedColumnsByIds([ColumnsId.endtime])} />
    );
    expect(wrapper.find(NetflowTableHeader)).toBeTruthy();
    expect(wrapper.find(Thead)).toHaveLength(1);
    expect(wrapper.find(Tr)).toHaveLength(1);
    expect(wrapper.find(Th)).toHaveLength(1);
  });
  it('should call sort function on click', async () => {
    const wrapper = mount(<NetflowTableHeaderWrapper {...mocks} columns={DefaultColumns} />);
    expect(wrapper.find(NetflowTableHeader)).toBeTruthy();
    wrapper.find('button').at(0).simulate('click');
    expect(mocks.onSort).toHaveBeenCalledWith('StartTime', 'asc');
  });
  it('should nested consecutive group columns', async () => {
    const selectedIds = [ColumnsId.endtime, ColumnsId.srcname, ColumnsId.srcport, ColumnsId.dstname, ColumnsId.packets];
    const wrapper = mount(<NetflowTableHeaderWrapper {...mocks} columns={filterOrderedColumnsByIds(selectedIds)} />);
    expect(wrapper.find(Thead)).toHaveLength(1);
    expect(wrapper.find(Tr)).toHaveLength(2);
    expect(wrapper.find(Th).length).toBeGreaterThanOrEqual(selectedIds.length);
  });
  it('should keep flat non consecutive group columns', async () => {
    const selectedIds = [ColumnsId.endtime, ColumnsId.srcname, ColumnsId.dstname, ColumnsId.packets, ColumnsId.srcport];
    const wrapper = mount(<NetflowTableHeaderWrapper {...mocks} columns={filterOrderedColumnsByIds(selectedIds)} />);
    expect(wrapper.find(Thead)).toHaveLength(1);
    expect(wrapper.find(Tr)).toHaveLength(1);
    expect(wrapper.find(Th)).toHaveLength(selectedIds.length);
  });
});
