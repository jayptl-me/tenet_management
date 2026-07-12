import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tenet_pg_portal/app.dart';

void main() {
  testWidgets('App boots into provider scope', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: TenetPortalApp(),
      ),
    );
    await tester.pump();
    expect(find.byType(TenetPortalApp), findsOneWidget);
  });
}
