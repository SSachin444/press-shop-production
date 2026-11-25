package com.phaindia.mes.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object PhaColors {
    val Canvas = Color(0xFFF8FAFC)
    val Surface = Color(0xFFFFFFFF)
    val Subtle = Color(0xFFF1F5F9)
    val Border = Color(0xFFE2E8F0)
    val BorderStrong = Color(0xFFCBD5E1)

    val InkPrimary = Color(0xFF0F172A)
    val InkSecondary = Color(0xFF334155)
    val InkMuted = Color(0xFF64748B)

    val Accent = Color(0xFFEA580C)
    val AccentHover = Color(0xFFC2410C)
    val AccentTint = Color(0xFFFFF7ED)
    val AccentBorder = Color(0xFFFED7AA)

    val StatusOk = Color(0xFF16A34A)
    val StatusOkBg = Color(0xFFF0FDF4)
    val StatusOkInk = Color(0xFF166534)

    val StatusWarn = Color(0xFFD97706)
    val StatusWarnBg = Color(0xFFFFFBEB)
    val StatusWarnInk = Color(0xFF92400E)

    val StatusErr = Color(0xFFDC2626)
    val StatusErrBg = Color(0xFFFEF2F2)
    val StatusErrInk = Color(0xFF991B1B)
}

private val LightColorScheme = lightColorScheme(
    primary = PhaColors.Accent,
    onPrimary = Color.White,
    primaryContainer = PhaColors.AccentTint,
    onPrimaryContainer = PhaColors.AccentHover,
    secondary = PhaColors.InkPrimary,
    onSecondary = Color.White,
    background = PhaColors.Canvas,
    onBackground = PhaColors.InkPrimary,
    surface = PhaColors.Surface,
    onSurface = PhaColors.InkPrimary,
    surfaceVariant = PhaColors.Subtle,
    onSurfaceVariant = PhaColors.InkSecondary,
    outline = PhaColors.BorderStrong,
    error = PhaColors.StatusErr,
    onError = Color.White,
)

private val PhaTypography = Typography(
    titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = PhaColors.InkPrimary),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = PhaColors.InkPrimary),
    titleSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = PhaColors.InkPrimary),
    bodyMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 14.sp, color = PhaColors.InkPrimary),
    bodySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Normal, fontSize = 12.sp, color = PhaColors.InkSecondary),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = PhaColors.InkSecondary),
    labelSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = PhaColors.InkMuted),
)

@Composable
fun PhaPressShopTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = PhaTypography,
        content = content,
    )
}
