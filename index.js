import axios from "axios";

const googleNewsUrl =
  "https://news.google.com/rss/articles/CBMingZBVV95cUxOTVZJamRQX0duZ2ExanV4ZEV2VjZaVHVCRDBudzFVazQzbmYwODM0Y29VZlpBS01UY2szTHBDUTcwaWtheTZUdnZiWjI1QXlsVlFUSHowNGtNaWkxdnpBOE9QRUd5ckVMNFdvZ3VDZi1DREo1N2pydWJ1ZTVJN3B4TEtya01nRWFqR2EtNlJkUTNhTWRVdmt0OFN0TGk5WGxneUh4Y1NOTElwTjVIazNpZVFVQmlNeERfd0VTNllhd0tlT21OcWVtcUNJaVJ3Q1RXeDRyaFJtTDdXdHlkeGN6RUwySE1VOTlReEp2NEp3enpid1NuWHFOYmVDMllBQzRVdWpCMVZDZGZ6aXV6MkJCYnMzWS1mNDM3R0hpV1FhVl9fZE1VZkhycnRmZTFhNXdsQUgwZHl6Q2JISFE2YV9OSVZUZnNNdjBacnRTS3VBZG1NTHJCZE1CT0hkd3VFQXgyOVVmSkFNbnBfVlUwYllQZDVvbUJCRElRWlVCbVNVNkRtMl9WY0xsZzNqcHlleWJnRWZ4bHh4NG94S0hQN1RkX2I4RW5LUnhBRXV3Z1FpMC1pSC1aZVJIVFlDajlFcWJGbHFSUE9RS3FQeGNaUVRaaG9vSlBTV2xUUWh3TDQ2bDEyWUFlSzdqSWg1UkNfU1ZZVWRQYnlORmZMNmM3SHFPS0hITHFHRmhoSVhYenFKUHVaTFdWLWlKOHdnMmFfeTVIRHhIaTFiWk5wM05UUWxKR29UWlcxRE9pdWsyQVhtTWxMcDFpNVdWRXRER1Zpek82UG01LVNrZXlaM1VlZ3VzSloxblktQTh0Zi1Wa0xGa21nWXdqVVRtUVJlbElTb0lzdDBHZklzR2Q3M0dmaTM4NlA1eW9PTEVrZFJJWEVsY0ZSZWp6T1ZIcWZ4VTUxNGk4ZS1iU2N4S1FCQUZMZTQ3WE1iT2RXMG9RV3I4YmF6cU1tY1NVSGw5N1h2aEl0NmRZNUwxcjhvX01BUjJDN2pXLWg4UVpUT05OX3pMMTh5eTJuZnpmY0IwM2h3cDVJZ2hHR0FTendwOUg2cklXbkE?oc=5";

(async () => {
  try {
    // Try request but prevent following redirects
    const response = await axios.get(googleNewsUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // If no redirect occurred (rare)
    console.log("✅ No redirect, URL:", response.request.res.responseUrl);
  } catch (err) {
    if (err.response?.headers?.location) {
      console.log("✅ Original Link:", err.response.headers.location);
    } else {
      console.error("❌ Error:", err.message);
    }
  }
})();
