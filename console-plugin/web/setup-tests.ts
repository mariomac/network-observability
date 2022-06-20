import { JSDOM } from 'jsdom';

const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/'
});
const { window } = jsdom;

function copyProps(src, target) {
  Object.defineProperties(target, {
    ...Object.getOwnPropertyDescriptors(src),
    ...Object.getOwnPropertyDescriptors(target)
  });
}

global.window = window as any;
global.document = window.document;
global.navigator = {
  userAgent: 'node.js'
} as any;
global.requestAnimationFrame = function (callback) {
  return setTimeout(callback, 0);
};
window.requestAnimationFrame = global.requestAnimationFrame;
global.cancelAnimationFrame = function (id) {
  clearTimeout(id);
};
copyProps(window, global);

//Mock i18n translation to return key
jest.mock('react-i18next', () => {
  return {
    useTranslation: () => {
      return {
        t: (s: string, ...args) => {
          if (args) {
            args.forEach(arg => {
              Object.keys(arg).forEach(key => {
                s = s.replace(`{{${key}}}`, arg[key]);
              });
            });
          }
          return s;
        },
      };
    }
  };
});

//Mock all console sdk components used here
jest.mock('@openshift-console/dynamic-plugin-sdk', () => {
  return {
    useResolvedExtensions: jest.fn(),
    useK8sModels: () => {
      return [{}, false];
    },
    ResourceLink: () => {
      return null;
    }
  };
});

//Mock useLayoutEffect to useEffect
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useLayoutEffect: jest.requireActual('react').useEffect
}));

//Mock patternfly Tooltip, DatePicker & OverflowMenuControl components
jest.mock('@patternfly/react-core', () => ({
  ...jest.requireActual('@patternfly/react-core'),
  Tooltip: (props: any) => {
    return props.children;
  },
  DatePicker: () => {
    return null;
  },
  OverflowMenuControl: () => {
    return null;
  }
}));

//SpyOn localStorage setItem
jest.spyOn(window.localStorage.__proto__, 'setItem');

//Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useHistory: () => ({
    push: jest.fn(),
  }),
  Link: () => {
    return null;
  }
}));

//Mock routes
jest.mock('./src/api/routes', () => ({
  getPods: jest.fn(async () => ['ABCD']),
  getNamespaces: jest.fn(async () => ['EFGH']),
  getConfig: jest.fn(async () => ({ portNaming: { enable: true, portNames: new Map() } })),
  getLokiReady: jest.fn(async () => 'ready'),
}));

global.console = {
  // console.log / warn / info / debug are ignored in tests
  log: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),

  // Keep native behaviour for error
  error: console.error,
};