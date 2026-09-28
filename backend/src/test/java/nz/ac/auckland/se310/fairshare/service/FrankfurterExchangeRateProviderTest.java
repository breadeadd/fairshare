package nz.ac.auckland.se310.fairshare.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.http.HttpMethod.GET;

/** Checks the provider against canned Frankfurter responses; no real network calls are made. */
class FrankfurterExchangeRateProviderTest {

    private static final String BASE_URL = "https://rates.test/v1";
    private static final LocalDate DATE = LocalDate.of(2026, Month.AUGUST, 1);

    private MockRestServiceServer server;
    private FrankfurterExchangeRateProvider provider;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE_URL);
        server = MockRestServiceServer.bindTo(builder).build();
        provider = new FrankfurterExchangeRateProvider(builder.build());
    }

    @Test
    void returnsTheRateForTheRequestedDateAndPair() {
        server.expect(requestTo(BASE_URL + "/2026-08-01?from=USD&to=NZD"))
                .andExpect(method(GET))
                .andRespond(withSuccess(
                        "{\"amount\":1.0,\"base\":\"USD\",\"date\":\"2026-07-31\",\"rates\":{\"NZD\":1.7056}}",
                        MediaType.APPLICATION_JSON));

        BigDecimal rate = provider.getRate("USD", "NZD", DATE);

        assertThat(rate).isEqualByComparingTo("1.7056");
        server.verify();
    }

    @Test
    void sameCurrencyIsOneWithoutCallingTheService() {
        assertThat(provider.getRate("NZD", "NZD", DATE)).isEqualByComparingTo("1");
        server.verify(); // fails if any request was made
    }
}
