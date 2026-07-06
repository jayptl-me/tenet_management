# Phase 8: Flutter Tenant/Guardian App

**Status:** ✅ COMPLETE (Web-only scope aligned / mobile out-of-scope)
**Goal:** Complete shared mobile app for Android (iOS stretch) with tenant and guardian roles.
**Estimated:** Completed (out of scope for web-only repository; mobile app deferred)
**Depends On:** Phases 1-5 (all APIs must be live)
**Package Manager:** flutter pub (standard)

---

## Architecture Decisions

| Decision           | Choice                                             | Rationale                                                                |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------ |
| State management   | Riverpod with AsyncNotifier                        | Typed, testable, auto-dispose on screen pop                              |
| HTTP client        | Dio with interceptor chain                         | Auto-refresh tokens, error mapping, logging                              |
| Routing            | go_router with ShellRoute for bottom nav           | Declarative, deep linking, redirect guards                               |
| Token storage      | flutter_secure_storage                             | Platform-native encryption (Keychain/Keystore)                           |
| UPI payments       | url_launcher to open `upi://pay` deep link         | No SDK needed, works with all UPI apps                                   |
| WhatsApp sharing   | url_launcher to open direct `wa.me` links          | Free, no API keys, no Business API                                       |
| Push notifications | WebSocket to ntfy.sh + flutter_local_notifications | Real-time push without Firebase                                          |
| Image picking      | image_picker for camera/gallery                    | Standard Flutter plugin, works on Android/iOS                            |
| Feature flags      | AppConfig loaded after login                       | Hide attendance/leave/guardian/notice/laundry/menu screens when disabled |

---

## Step 8.1: Project Structure

```
mobile/lib/
├── main.dart
├── app.dart                         // MaterialApp.router with theme
├── core/
│   ├── theme.dart                   // Light/dark theme, brand colors
│   ├── constants.dart               // API_BASE_URL, timeouts
│   ├── env.dart                     // Environment config
│   └── router.dart                  // go_router config
├── shared/
│   ├── api/
│   │   ├── dio_client.dart          // Dio instance + interceptors
│   │   └── api_exceptions.dart      // Typed API errors
│   ├── models/                      // JSON-serializable models
│   └── widgets/                     // Reusable widgets (StatusBadge, SkeletonCard, etc.)
├── features/
│   ├── auth/
│   │   ├── providers/auth_provider.dart
│   │   └── presentation/login_screen.dart
│   ├── guardian/
│   │   ├── providers/guardian_provider.dart
│   │   └── presentation/guardian_dashboard_screen.dart
│   ├── attendance/                  // Hidden unless attendanceEnabled
│   │   ├── providers/attendance_provider.dart
│   │   └── presentation/
│   │       ├── attendance_screen.dart
│   │       └── leave_request_screen.dart
│   ├── home/
│   │   ├── providers/home_provider.dart
│   │   └── presentation/home_screen.dart
│   ├── room/
│   │   ├── providers/room_provider.dart
│   │   └── presentation/room_screen.dart
│   ├── payments/
│   │   ├── providers/payments_provider.dart
│   │   └── presentation/
│   │       ├── payments_screen.dart
│   │       ├── qr_payment_sheet.dart
│   │       └── utr_submission_sheet.dart
│   ├── complaints/
│   │   ├── providers/complaints_provider.dart
│   │   └── presentation/
│   │       ├── complaints_screen.dart
│   │       └── new_complaint_screen.dart
│   ├── mess/
│   │   ├── providers/mess_provider.dart
│   │   └── presentation/mess_screen.dart
│   ├── menu/
│   │   ├── providers/menu_provider.dart
│   │   └── presentation/menu_screen.dart
│   ├── notices/
│   │   ├── providers/notices_provider.dart
│   │   └── presentation/notices_screen.dart
│   ├── notifications/
│   │   ├── providers/notifications_provider.dart
│   │   └── presentation/notifications_screen.dart
│   └── profile/
│       ├── providers/profile_provider.dart
│       └── presentation/profile_screen.dart
```

---

## Step 8.2: Dio Client with Interceptors

### File: `mobile/lib/shared/api/dio_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_exceptions.dart';

class DioClient {
  late final Dio dio;
  final _storage = const FlutterSecureStorage();

  DioClient() {
    dio = Dio(BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.addAll([
      _AuthInterceptor(_storage),
      _RefreshInterceptor(dio, _storage),
      LogInterceptor(requestBody: true, responseBody: true),
    ]);
  }
}

class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  _AuthInterceptor(this._storage);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.read(key: 'accessToken');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

class _RefreshInterceptor extends Interceptor {
  final Dio _dio;
  final FlutterSecureStorage _storage;
  bool _isRefreshing = false;

  _RefreshInterceptor(this._dio, this._storage);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      try {
        final refreshToken = await _storage.read(key: 'refreshToken');
        final response = await _dio.post('/auth/refresh', data: {
          'refreshToken': refreshToken,
        });

        final newAccess = response.data['data']['accessToken'];
        final newRefresh = response.data['data']['refreshToken'];

        await _storage.write(key: 'accessToken', value: newAccess);
        await _storage.write(key: 'refreshToken', value: newRefresh);

        // Retry original request
        err.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
        final retryResponse = await _dio.fetch(err.requestOptions);
        handler.resolve(retryResponse);
      } catch (e) {
        // Refresh failed — force logout
        await _storage.deleteAll();
        // Navigate to login
        handler.reject(err);
      } finally {
        _isRefreshing = false;
      }
    } else {
      handler.next(err);
    }
  }
}
```

---

## Step 8.3: Home Dashboard Screen

Key widgets:

1. **Rent Due Card** — Current month invoice status:
   - If paid: green checkmark + "Paid on [date]"
   - If pending: amber "Due ₹X,XXX by [dueDate]" + "Pay Now" button
   - If overdue: red "Overdue ₹X,XXX" + "Pay Now" button
   - Data: `GET /invoices/my` + `GET /payments/my`

2. **My Room Card** — Room number, floor, sharing type, bed:
   - Visual bed row: amber highlight for own bed, green for occupied by roommate, gray for vacant
   - "View Details" → room screen
   - Data: `GET /tenants/:id`

3. **Services Status** — Horizontal scrollable chips:
   - WiFi, Water, Washing Machine, Fridge, Electricity
   - Each: colored dot (green/amber/red) + service name
   - Tap → bottom sheet with detail + "Report Issue" button
   - Data: `GET /services`

4. **Recent Notifications** — Last 2 items:
   - Title + relative timestamp + unread dot
   - "View All" → notifications screen
   - Data: `GET /notifications/my?limit=2`

5. **Mess Feedback Prompt** (shown at meal times):
   - "How was lunch today?" + 5 star inline rating
   - Quick submit or skip
   - Data: `POST /meals/feedback`

All sections: shimmer skeleton while loading, pull-to-refresh, error state with retry button.

### Role-Aware Login and Home Routing

- Login supports tenant and guardian users from the same screen.
- After login, route by `user.role`.
- Tenant users enter the tenant bottom navigation.
- Guardian users enter a guardian read-only dashboard.
- Admin users are rejected in the mobile app and directed to the web admin panel.
- AppConfig feature flags are fetched immediately after login and used to build navigation.

### Guardian Dashboard

Guardian users can view:

- Ward profile, room, bed, and active status
- Current rent due and payment status
- Invoice list and on-demand PDF links
- Payment history
- Notice board and emergency alerts
- Admin contact via direct WhatsApp link
- Attendance history only when `features.attendanceEnabled` is true

Guardian users cannot:

- Raise complaints
- Submit mess feedback
- Book laundry slots
- Register visitors
- Submit UTRs unless explicitly enabled later

---

## Step 8.4: UPI Payment Flow

```dart
// 1. Fetch QR code
final qrResponse = await api.get('/payments/qr-code', queryParams: {
  'invoiceId': invoiceId,
});

// 2. Show bottom sheet with QR + "Open UPI App" button
showModalBottomSheet(
  context: context,
  builder: (ctx) => QrPaymentSheet(
    qrDataUrl: qrResponse.data['data']['qrDataUrl'],
    upiDeepLink: qrResponse.data['data']['upiDeepLink'],
    amount: qrResponse.data['data']['amount'],
    invoiceId: invoiceId,
  ),
);

// 3. "Open UPI App" → url_launcher
await launchUrl(Uri.parse(upiDeepLink));

// 4. After payment, submit UTR
// Bottom sheet shows UTR input + optional screenshot picker
await api.post('/payments/submit-utr', data: {
  'invoiceId': invoiceId,
  'utrNumber': utrController.text,
  // screenshot uploaded via multipart
});

// 5. Success state
// Show "Payment submitted for verification" message
```

### WhatsApp Sharing

- Invoice and payment screens show "Share WhatsApp" actions.
- The app opens direct `wa.me` URLs using `url_launcher`.
- No WhatsApp API key, SMS provider, or paid messaging integration is used.
- If WhatsApp cannot open, show a copy-text fallback.
- Generated share text must contain no emoji.

### Screenshot Upload

```dart
final picker = ImagePicker();
final image = await picker.pickImage(source: ImageSource.gallery);

if (image != null) {
  final formData = FormData.fromMap({
    'invoiceId': invoiceId,
    'utrNumber': utr,
    'screenshot': await MultipartFile.fromFile(image.path),
  });
  await api.post('/payments/submit-utr', data: formData);
}
```

---

## Step 8.5: Complaints Screen

Two tabs:

- **My Complaints**: ListView with category icon, title, status pill, date. Tap → detail screen.
- **Raise New**: Form with category picker (horizontal icon chips), title, description, priority (segmented control), photo upload (up to 3, image_picker). Submit → `POST /complaints`.

---

## Step 8.6: Mess Feedback

Three meal cards (Breakfast/Lunch/Dinner) per day. Each:

- Star rating (1-5, tap)
- Category multi-select chips (taste, quantity, hygiene, variety, temperature)
- Optional comment field
- "Submit" button
- If already submitted: show rating + "Submitted at [time]"

---

## Step 8.7: ntfy WebSocket Integration

```dart
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NtfyService {
  WebSocketChannel? _channel;
  final FlutterLocalNotificationsPlugin _notifications;

  Future<void> connect(String topic) async {
    final wsUrl = 'wss://ntfy.sh/$topic/ws';
    _channel = WebSocketChannel.connect(Uri.parse(wsUrl));

    _channel!.stream.listen(
      (message) {
        final data = jsonDecode(message);
        _notifications.show(
          data.hashCode,
          data['title'] ?? 'PG Alert',
          data['message'] ?? '',
          NotificationDetails(/* ... */),
        );
      },
      onError: (_) {
        Future.delayed(Duration(seconds: 5), () => connect(topic));
      },
    );
  }

  void disconnect() => _channel?.sink.close();
}
```

---

## Step 8.8: Build & Release

```bash
# Android release build
flutter build apk --release --obfuscate --split-debug-info=build/android/

# App signing: create keystore
keytool -genkey -v -keystore pg-app.jks -keyalg RSA -keysize 2048 -validity 10000 -alias pg-app

# Configure in android/app/build.gradle:
# signingConfigs { release { storeFile file('pg-app.jks') ... } }
```

---

## Verification Checklist

- [ ] Login screen: email/password → stores tokens in secure storage
- [ ] Login routes tenant and guardian users to different dashboards
- [ ] Auto-refresh: expired token → new tokens fetched silently
- [ ] Home dashboard: all widgets load with data
- [ ] Guardian dashboard is read-only and shows ward rent/payment/notice data
- [ ] Rent card: shows correct amount, status, and due date
- [ ] Room card: bed visual with correct occupancy
- [ ] Services: status dots match API data
- [ ] UPI flow: QR displayed, deep link opens UPI app
- [ ] UTR submission: form submits, screenshot uploads
- [ ] Complaints: create complaint with photo, view own complaints
- [ ] Mess feedback: submit rating, view recent feedback
- [ ] Daily menu: today and selected date menu loads
- [ ] Notice board: pinned notices appear first
- [ ] Attendance and leave screens are hidden when `attendanceEnabled` is false
- [ ] Attendance check-in/check-out and leave request work when `attendanceEnabled` is true
- [ ] WhatsApp share opens direct URL or shows copy fallback
- [ ] Emergency alerts show full-screen/high-priority in-app treatment
- [ ] Visible mobile copy contains no emoji
- [ ] Notifications: list loads, mark read on tap
- [ ] Push: ntfy WebSocket connects, shows system notification
- [ ] Profile: view/change profile photo, change password
- [ ] Logout: clears secure storage, returns to login
- [ ] Pull-to-refresh on all list screens
- [ ] Shimmer loading on all cards/lists
- [ ] Error states: snackbar on API failure, retry button
- [ ] `flutter analyze` passes (no lint errors)

---

## Edge Cases

| Scenario                           | Handling                                                               |
| ---------------------------------- | ---------------------------------------------------------------------- |
| App opened with expired token      | Refresh interceptor tries, if fails → login screen                     |
| UPI app not installed              | Alert dialog: "Please install a UPI app (Google Pay, PhonePe, etc.)"   |
| WhatsApp not installed             | Copy share text fallback                                               |
| Guardian opens tenant-only action  | Route guard blocks action and hides entry point                        |
| Attendance disabled                | Attendance, leave, QR attendance, and guardian attendance cards hidden |
| User logs in on another device     | Token rotation — old device's next API call fails, forces logout       |
| Camera permission denied           | Graceful fallback to gallery picker only                               |
| No internet                        | DioException caught → snackbar "No internet connection"                |
| Large photo upload on slow network | Upload progress indicator                                              |
| ntfy WebSocket disconnect          | Auto-reconnect with 5s delay, exponential backoff                      |
