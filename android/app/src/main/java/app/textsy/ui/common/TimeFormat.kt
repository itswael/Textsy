package app.textsy.ui.common

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/** Formats the ISO-8601 timestamps the server sends for display. */
object TimeFormat {
    /**
     * Time for today, [yesterday] for the day before, a short date otherwise.
     * Used in the chat list and for "last seen".
     */
    fun relative(
        iso: String,
        yesterday: String,
        now: Instant = Instant.now(),
        zone: ZoneId = ZoneId.systemDefault(),
        locale: Locale = Locale.getDefault(),
    ): String {
        val moment = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
        val day = moment.atZone(zone).toLocalDate()
        val today = now.atZone(zone).toLocalDate()
        return when {
            day == today -> time(iso, zone, locale)
            day == today.minusDays(1) -> yesterday
            day.year == today.year -> DateTimeFormatter.ofPattern("d MMM", locale).format(day)
            else -> DateTimeFormatter.ofPattern("d MMM yyyy", locale).format(day)
        }
    }

    /** Clock time in the person's usual format, e.g. 3:42 pm. */
    fun time(iso: String, zone: ZoneId = ZoneId.systemDefault(), locale: Locale = Locale.getDefault()): String {
        val moment = runCatching { Instant.parse(iso) }.getOrNull() ?: return ""
        return DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale).format(moment.atZone(zone))
    }
}
