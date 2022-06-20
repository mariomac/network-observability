import { defaultConfig } from '../model/config';
import { getConfig } from '../api/routes';
import { getHTTPErrorDetails } from './errors';

export let config = defaultConfig;

export const loadConfig = async () => {
  try {
    config = await getConfig();
  } catch (err) {
    console.log(getHTTPErrorDetails(err));
  }
};
