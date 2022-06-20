package httpclient

import (
	"crypto/tls"
	"io/ioutil"
	"net"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"
)

type Caller interface {
	Get(url string) ([]byte, int, error)
}

type httpClient struct {
	Caller
	client  http.Client
	headers map[string][]string
}

var slog = logrus.WithField("module", "server")

func NewHTTPClient(timeout time.Duration, overrideHeaders map[string][]string, skipTLS bool) Caller {
	transport := &http.Transport{
		DialContext:     (&net.Dialer{Timeout: timeout}).DialContext,
		IdleConnTimeout: timeout,
	}

	//TODO: add loki tls config https://issues.redhat.com/browse/NETOBSERV-309
	if skipTLS {
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
		slog.Warn("skipping TLS checks. SSL certificate verification is now disabled !")
	}

	return &httpClient{
		client:  http.Client{Transport: transport, Timeout: timeout},
		headers: overrideHeaders,
	}
}

func (hc *httpClient) Get(url string) ([]byte, int, error) {
	// TODO: manage authentication / TLS

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	for k, v := range hc.headers {
		req.Header[k] = v
	}

	resp, err := hc.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	return body, resp.StatusCode, err
}
