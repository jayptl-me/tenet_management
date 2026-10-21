import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tenet_pg_portal/features/shared/widgets/portal_widgets.dart';

/// The background colour the shared status chip paints for one label.
Future<Color?> chipColor(WidgetTester tester, String label) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(body: Center(child: StatusChip(label: label))),
    ),
  );
  final container = tester.widget<Container>(
    find
        .descendant(
          of: find.byType(StatusChip),
          matching: find.byType(Container),
        )
        .first,
  );
  final decoration = container.decoration;
  if (decoration is! BoxDecoration) return null;
  return decoration.color;
}

void main() {
  testWidgets('the visitor states expected, arrived and departed do not all look the same', (tester) async {
    final expected = await chipColor(tester, 'expected');
    final arrived = await chipColor(tester, 'arrived');
    final departed = await chipColor(tester, 'departed');

    expect(expected, isNotNull);
    expect(arrived, isNotNull);
    expect(departed, isNotNull);

    expect(expected, isNot(arrived));
    expect(arrived, isNot(departed));
    expect(expected, isNot(departed));
  });

  testWidgets('a status the API does not define stays on the neutral tone', (tester) async {
    final unknown = await chipColor(tester, 'not_a_status');

    expect(unknown, isNotNull);
  });
}
