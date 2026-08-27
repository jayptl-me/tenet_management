import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tenet_pg_portal/features/auth/presentation/login_screen.dart';

void main() {
  Widget buildSubject() {
    return const ProviderScope(
      child: MaterialApp(
        home: LoginScreen(),
      ),
    );
  }

  testWidgets('LoginScreen renders header, inputs, and submit button', (tester) async {
    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('Tenant · Guardian · Visitor portals'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Forgot password?'), findsOneWidget);
  });

  testWidgets('Submitting empty form displays validation error messages', (tester) async {
    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    final signInButton = find.widgetWithText(FilledButton, 'Sign in');
    await tester.tap(signInButton);
    await tester.pumpAndSettle();

    expect(find.text('Email required'), findsOneWidget);
    expect(find.text('Password must be at least 6 characters'), findsOneWidget);
  });

  testWidgets('Toggling password visibility switches obscureText state', (tester) async {
    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    // Password field has an EditableText child
    final editableFinder = find.byType(EditableText).at(1);
    final editable = tester.widget<EditableText>(editableFinder);
    expect(editable.obscureText, true);

    // Tap the visibility icon
    final toggleButton = find.byIcon(Icons.visibility_outlined);
    expect(toggleButton, findsOneWidget);

    await tester.tap(toggleButton);
    await tester.pumpAndSettle();

    final updatedEditable = tester.widget<EditableText>(editableFinder);
    expect(updatedEditable.obscureText, false);
  });
}
