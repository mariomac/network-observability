import { useResolvedExtensions } from '@openshift-console/dynamic-plugin-sdk';
import { mount, render, shallow } from 'enzyme';
import * as React from 'react';
import { waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { getFlows } from '../../api/routes';
import NetflowTraffic from '../netflow-traffic';
import { extensionsMock } from '../__tests-data__/extensions';
import { FlowsResultSample } from '../__tests-data__/flows';
import NetflowTrafficParent from '../netflow-traffic-parent';

const useResolvedExtensionsMock = useResolvedExtensions as jest.Mock;

jest.mock('../../api/routes', () => ({
  getFlows: jest.fn(() => Promise.resolve(FlowsResultSample))
}));
const getFlowsMock = getFlows as jest.Mock;

describe('<NetflowTraffic />', () => {
  beforeAll(() => {
    useResolvedExtensionsMock.mockReturnValue(extensionsMock);
  });

  it('should shallow component', async () => {
    const wrapper = shallow(<NetflowTrafficParent />);
    expect(wrapper.find(NetflowTraffic)).toBeTruthy();
    expect(localStorage.setItem).toHaveBeenCalledTimes(0);
  });

  it('should render refresh components', async () => {
    act(() => {
      const cheerio = render(<NetflowTrafficParent />);
      expect(cheerio.find('#refresh-dropdown').length).toEqual(1);
      expect(cheerio.find('#refresh-button').length).toEqual(1);
    });
  });

  it('should refresh on button click', async () => {
    const wrapper = mount(<NetflowTrafficParent />);
    act(() => {
      //should have called getFlow twice after click
      wrapper.find('#refresh-button').at(0).simulate('click');
    });
    await waitFor(() => {
      expect(getFlowsMock).toHaveBeenCalledTimes(1);
    });
  });

  it('should render toolbar components', async () => {
    act(() => {
      const cheerio = render(<NetflowTrafficParent />);
      expect(cheerio.find('#filter-toolbar').length).toEqual(1);
      expect(cheerio.find('#manage-columns-button').length).toEqual(1);
    });
  });
});
