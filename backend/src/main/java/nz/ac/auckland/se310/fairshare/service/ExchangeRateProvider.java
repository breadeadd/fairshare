package nz.ac.auckland.se310.fairshare.service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * #14: looks up how many units of {@code to} one unit of {@code from} was worth on a given date.
 * Kept behind an interface so tests can supply fixed rates without touching the network.
 */
public interface ExchangeRateProvider {

    BigDecimal getRate(String from, String to, LocalDate date);
}
