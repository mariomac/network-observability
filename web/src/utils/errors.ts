// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getHTTPErrorDetails = (err: any) => {
  console.log('getHTTPErrorDetails', err);
  if (err?.response?.data) {
    const header = err.toString === Object.prototype.toString ? '' : `${err}\n`;
    if (typeof err.response.data === 'object') {
      return (
        header +
        Object.keys(err.response.data)
          .map(key => String(err.response.data[key]))
          .join('\n')
      );
    }
    return header + String(err.response.data);
  }
  return String(err);
};
