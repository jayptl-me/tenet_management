import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  AppTheme._();

  static const Color brand = Color(0xFF0F766E);
  static const Color brandDark = Color(0xFF115E59);
  static const Color surface = Color(0xFFF8FAFC);
  static const Color card = Color(0xFFFFFFFF);
  static const Color danger = Color(0xFFDC2626);
  static const Color dangerSoft = Color(0xFFFEF2F2);
  static const Color dangerText = Color(0xFF991B1B);
  static const Color warning = Color(0xFFD97706);
  static const Color warningSoft = Color(0xFFFEF3C7);
  static const Color warningText = Color(0xFF92400E);
  static const Color success = Color(0xFF065F46);
  static const Color successSoft = Color(0xFFECFDF5);
  /// Informational: a state that is closed and needs no action, such as a
  /// visitor who has already left.
  static const Color info = Color(0xFF1D4ED8);
  static const Color infoSoft = Color(0xFFEFF6FF);
  static const Color muted = Color(0xFF64748B);
  static const Color mutedSoft = Color(0xFF94A3B8);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: brand,
      brightness: Brightness.light,
      primary: brand,
      error: danger,
    );
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: surface,
    );

    return base.copyWith(
      textTheme: _interTextTheme(base.textTheme),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: card,
        foregroundColor: scheme.onSurface,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: brand,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: card,
        indicatorColor: brand.withValues(alpha: 0.12),
        labelTextStyle: WidgetStatePropertyAll(
          GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

/// Applies Inter to every style of [base], returning an SDK [TextTheme].
///
/// google_fonts 9 moved the *TextTheme helpers onto the material_ui fork, whose
/// TextTheme is a foreign type, so the SDK theme is built manually from the
/// per-style tear-off (TextStyle is shared and assigns cleanly).
TextTheme _interTextTheme(TextTheme base) {
  return TextTheme(
    displayLarge: GoogleFonts.inter(textStyle: base.displayLarge),
    displayMedium: GoogleFonts.inter(textStyle: base.displayMedium),
    displaySmall: GoogleFonts.inter(textStyle: base.displaySmall),
    headlineLarge: GoogleFonts.inter(textStyle: base.headlineLarge),
    headlineMedium: GoogleFonts.inter(textStyle: base.headlineMedium),
    headlineSmall: GoogleFonts.inter(textStyle: base.headlineSmall),
    titleLarge: GoogleFonts.inter(textStyle: base.titleLarge),
    titleMedium: GoogleFonts.inter(textStyle: base.titleMedium),
    titleSmall: GoogleFonts.inter(textStyle: base.titleSmall),
    bodyLarge: GoogleFonts.inter(textStyle: base.bodyLarge),
    bodyMedium: GoogleFonts.inter(textStyle: base.bodyMedium),
    bodySmall: GoogleFonts.inter(textStyle: base.bodySmall),
    labelLarge: GoogleFonts.inter(textStyle: base.labelLarge),
    labelMedium: GoogleFonts.inter(textStyle: base.labelMedium),
    labelSmall: GoogleFonts.inter(textStyle: base.labelSmall),
  );
}
