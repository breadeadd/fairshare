package nz.ac.auckland.se310.fairshare.service;

import nz.ac.auckland.se310.fairshare.dto.CurrencyResponse;
import nz.ac.auckland.se310.fairshare.exception.UnsupportedCurrencyException;
import org.springframework.stereotype.Service;

import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

@Service
public class CurrencyService {

    /**
     * ISO 4217 codes an expense can be entered in. Every code here must also be quoted by the
     * exchange rate provider, otherwise expenses in it can never be converted.
     */
    private static final Set<String> SUPPORTED_CODES = new TreeSet<>(Set.of(
            "AUD", "BRL", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD", "IDR", "INR", "JPY",
            "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "SEK", "SGD", "THB", "USD", "ZAR"));

    private static final List<CurrencyResponse> SUPPORTED_CURRENCIES = SUPPORTED_CODES.stream()
            .map(code -> new CurrencyResponse(
                    code, Currency.getInstance(code).getDisplayName(Locale.ENGLISH)))
            .toList();

    // AC3: supported currencies with their ISO 4217 codes, sorted by code.
    public List<CurrencyResponse> getSupportedCurrencies() {
        return SUPPORTED_CURRENCIES;
    }

    // Case and surrounding spaces are ignored, so " usd " is read as USD.
    public boolean isSupported(String code) {
        return code != null && SUPPORTED_CODES.contains(normalise(code));
    }

    /** Returns the canonical code (e.g. "USD" for " usd "), or throws if it is not supported. */
    public String requireSupported(String code) {
        if (!isSupported(code)) {
            throw new UnsupportedCurrencyException(code); // AC3
        }
        return normalise(code);
    }

    private static String normalise(String code) {
        return code.trim().toUpperCase(Locale.ROOT);
    }
}
