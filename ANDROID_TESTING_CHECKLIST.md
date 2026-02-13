# Betgistics Android App - QA Testing Checklist

## Authentication

- [ ] Google OAuth login completes successfully and returns user to the app
- [ ] Google OAuth login displays correct Google account picker
- [ ] Logout clears session data and returns user to the login screen
- [ ] Session persists across app restarts (user remains logged in)
- [ ] Session persists after device reboot
- [ ] Token refresh occurs transparently without user intervention
- [ ] Expired token triggers re-authentication gracefully
- [ ] Login failure displays a meaningful error message
- [ ] Cancelling Google sign-in returns user to the login screen without crashing
- [ ] Multiple Google accounts on the same device are handled correctly

## Kelly Criterion Calculator

### Input Validation
- [ ] Non-numeric input is rejected or prevented
- [ ] Empty fields display appropriate validation messages
- [ ] Negative values are handled appropriately for each field
- [ ] Extremely large values do not cause overflow or crashes
- [ ] Decimal inputs are accepted and processed correctly
- [ ] Fields enforce reasonable min/max bounds

### Calculation Accuracy
- [ ] Full Kelly calculation matches expected mathematical output
- [ ] Half Kelly returns exactly 50% of full Kelly recommendation
- [ ] Quarter Kelly returns exactly 25% of full Kelly recommendation
- [ ] Results match manual calculations for known test cases
- [ ] Bankroll percentage recommendation is displayed clearly
- [ ] Suggested wager amount is calculated correctly from bankroll size

### Edge Cases
- [ ] 0% probability input returns no bet recommendation
- [ ] 100% probability input is handled correctly
- [ ] Negative odds (favorites) produce correct Kelly output
- [ ] Even odds (e.g., +100 / 2.00) produce correct Kelly output
- [ ] Very long odds (e.g., +10000) produce correct output
- [ ] Probability equal to implied probability returns zero edge / no bet
- [ ] Probability below implied probability returns negative Kelly (no bet)
- [ ] Zero bankroll input is handled without division errors

## Probability Estimators

### Football (NFL) Estimator
- [ ] All required input fields are present and labeled
- [ ] Estimator produces probability output within 0-100% range
- [ ] Changing inputs updates the estimate in real time or on submission
- [ ] Known matchup scenarios produce reasonable estimates
- [ ] Results can be sent to the Kelly Calculator

### Basketball (NBA) Estimator
- [ ] All required input fields are present and labeled
- [ ] Estimator produces probability output within 0-100% range
- [ ] Changing inputs updates the estimate in real time or on submission
- [ ] Known matchup scenarios produce reasonable estimates
- [ ] Results can be sent to the Kelly Calculator

### Hockey (NHL) Estimator
- [ ] All required input fields are present and labeled
- [ ] Estimator produces probability output within 0-100% range
- [ ] Changing inputs updates the estimate in real time or on submission
- [ ] Known matchup scenarios produce reasonable estimates
- [ ] Results can be sent to the Kelly Calculator

### Walters Protocol Calculations
- [ ] Walters Protocol inputs are clearly explained to the user
- [ ] Calculations follow the documented Walters Protocol methodology
- [ ] Output values are within expected ranges
- [ ] Protocol results integrate correctly with Kelly Calculator
- [ ] Edge cases in protocol inputs do not produce nonsensical output

## AI Matchup Analysis

### Gemini AI Integration
- [ ] AI analysis request is sent successfully with correct parameters
- [ ] API key is stored securely and not exposed in logs or UI
- [ ] Request payload contains all necessary matchup context

### Response Handling
- [ ] AI response is displayed in a readable, well-formatted layout
- [ ] Long responses are scrollable
- [ ] Markdown or structured content in responses renders correctly
- [ ] Response loading indicator is visible during API call

### Error States
- [ ] Network timeout displays a retry option
- [ ] API rate limiting is communicated to the user
- [ ] Malformed API response does not crash the app
- [ ] Empty or null response is handled with a user-friendly message
- [ ] Server error (5xx) displays appropriate feedback
- [ ] Unauthorized (401/403) triggers re-authentication or clear error

## Bet Logging

### Create New Bets
- [ ] All required fields are present (sport, teams, odds, stake, date)
- [ ] Date picker defaults to today and allows past/future dates
- [ ] Odds format entry accepts American, decimal, and fractional (if supported)
- [ ] Bet is saved and appears in bet history immediately
- [ ] Duplicate bet warning or prevention works correctly

### View Bet History
- [ ] Bet history loads and displays all logged bets
- [ ] Bets are sorted by date (most recent first)
- [ ] Filtering by sport, date range, or outcome works correctly
- [ ] Bet details expand or navigate to a detail view
- [ ] Empty state is shown when no bets exist

### Update Outcomes
- [ ] Pending bets can be marked as win, loss, or push
- [ ] Outcome update reflects in profit/loss calculations
- [ ] Outcome can be changed after initial entry (correction flow)
- [ ] Updating outcome refreshes aggregate statistics

### CSV Export
- [ ] Export button is accessible from bet history screen
- [ ] CSV file is generated with correct headers and data
- [ ] CSV contains all logged bets with complete information
- [ ] Export handles special characters in team names or notes
- [ ] Share sheet or file save dialog appears after export
- [ ] Exported file opens correctly in spreadsheet applications

## Navigation

### Bottom Navigation Tabs
- [ ] All tabs are visible and labeled with icons and text
- [ ] Tapping a tab navigates to the correct screen
- [ ] Active tab is visually highlighted
- [ ] Tab state is preserved when switching between tabs
- [ ] Scroll position is maintained when returning to a tab

### Back Button Behavior
- [ ] Hardware back button navigates to the previous screen
- [ ] Back from the home/root screen prompts exit or exits the app
- [ ] Back button closes open dialogs and bottom sheets before navigating
- [ ] Back navigation does not skip screens unexpectedly
- [ ] Predictive back gesture (Android 14+) works correctly

### Deep Links
- [ ] Deep links open the correct screen within the app
- [ ] Deep links work when the app is not already running
- [ ] Deep links work when the app is in the background
- [ ] Invalid deep links are handled gracefully (redirect to home or error)

### Screen Transitions
- [ ] Transitions between screens are smooth and consistent
- [ ] No visual glitches or blank frames during transitions
- [ ] Transition animations complete without jank

## Offline Behavior

### Network Disconnect Handling
- [ ] App detects loss of network connectivity
- [ ] User is informed of offline status via banner or snackbar
- [ ] Actions requiring network display appropriate offline message
- [ ] App does not crash when network is unavailable
- [ ] Airplane mode toggle is handled gracefully

### Cached Data Display
- [ ] Previously loaded bet history is available offline
- [ ] Previously loaded calculator results remain visible
- [ ] Cached data is clearly indicated as potentially stale (if applicable)

### Reconnection
- [ ] App detects network restoration automatically
- [ ] Pending actions (e.g., bet saves) are retried or synced on reconnection
- [ ] Offline banner or indicator is dismissed on reconnection
- [ ] No duplicate data is created from offline/online sync

## UI/UX

### Touch Targets
- [ ] All interactive elements meet the 48dp minimum touch target size
- [ ] Buttons, icons, and links are easy to tap without accidental triggers
- [ ] Spacing between adjacent touch targets prevents mis-taps

### Keyboard Handling
- [ ] Soft keyboard appears when text fields are focused
- [ ] Keyboard type matches the input (numeric keyboard for number fields)
- [ ] Keyboard dismisses when tapping outside input fields
- [ ] Screen content scrolls to keep focused field visible above keyboard
- [ ] IME action button (Done/Next) behaves correctly

### Different Screen Sizes
- [ ] Phone layout (small, 5-6 inch) displays correctly
- [ ] Large phone layout (6-7 inch) displays correctly
- [ ] Tablet layout (7-10+ inch) utilizes available space
- [ ] Foldable device configurations are handled (if applicable)
- [ ] No content is cut off or overlapping on any supported size

### Orientation
- [ ] Portrait mode displays correctly on all screens
- [ ] Landscape mode displays correctly on all screens
- [ ] Rotating the device does not lose user input or state
- [ ] Rotation during API calls does not crash or lose responses

### Dark Theme Consistency
- [ ] All screens render correctly in dark theme
- [ ] Text is legible against dark backgrounds (sufficient contrast)
- [ ] Icons and images have appropriate dark theme variants
- [ ] No hardcoded light-theme colors bleed through in dark mode
- [ ] System theme toggle is respected (follow system setting)
- [ ] Manual theme override within the app works correctly

### Loading States
- [ ] Loading indicators appear for all network requests
- [ ] Skeleton screens or shimmer effects are used where appropriate
- [ ] Loading states do not flicker for fast responses
- [ ] Long-running operations show progress or indeterminate indicators
- [ ] Users cannot trigger duplicate requests by tapping during loading

## Performance

### App Launch Time
- [ ] Cold start completes in under 2 seconds on mid-range devices
- [ ] Warm start completes in under 1 second
- [ ] Splash screen displays during initialization
- [ ] No ANR (Application Not Responding) on startup

### Scroll Performance
- [ ] Bet history list scrolls at 60fps without dropped frames
- [ ] Large data sets use lazy loading or pagination
- [ ] Scrolling does not cause visible jank or stuttering
- [ ] RecyclerView or LazyColumn view recycling works correctly

### Memory Usage
- [ ] App memory usage stays within reasonable bounds during normal use
- [ ] No memory leaks detected during extended use sessions
- [ ] Navigating between screens does not continuously increase memory
- [ ] Large images or data sets are properly released when no longer needed

### Battery Impact
- [ ] App does not consume excessive battery in the foreground
- [ ] App does not perform unnecessary background work
- [ ] Network requests are batched or minimized where possible
- [ ] No wake locks are held beyond what is necessary

## Android Compatibility

### SDK Versions
- [ ] App installs and runs on Android 7.0 (API 24) devices
- [ ] App installs and runs on Android 14 (API 34) devices
- [ ] App installs and runs on Android 15 (API 35) devices
- [ ] App targets SDK 36 and compiles without deprecation issues
- [ ] New platform features degrade gracefully on older SDK versions

### Screen Densities
- [ ] App renders correctly on mdpi (~160dpi) screens
- [ ] App renders correctly on hdpi (~240dpi) screens
- [ ] App renders correctly on xhdpi (~320dpi) screens
- [ ] App renders correctly on xxhdpi (~480dpi) screens
- [ ] App renders correctly on xxxhdpi (~640dpi) screens
- [ ] Vector drawables scale cleanly across all densities
- [ ] No pixelated or blurry images on high-density screens

### Different Android Versions
- [ ] Permissions model works on Android 7-9 (runtime permissions)
- [ ] Scoped storage is handled on Android 10+
- [ ] Notification permissions prompt appears on Android 13+
- [ ] Foreground service restrictions are respected on Android 12+
- [ ] Edge-to-edge display is handled on Android 15+

## Play Store Compliance

### Permissions Justified
- [ ] INTERNET permission is declared and justified (network access)
- [ ] No unnecessary permissions are requested
- [ ] Runtime permissions include clear rationale dialogs
- [ ] Denied permissions degrade gracefully without crashing
- [ ] "Don't ask again" permission state is handled with settings redirect

### No Prohibited Content
- [ ] App does not facilitate real-money gambling (or complies with regional regulations)
- [ ] Content complies with Google Play Developer Program Policies
- [ ] No misleading claims about guaranteed winnings
- [ ] Responsible gambling disclaimers are present where appropriate

### Age Rating Appropriate
- [ ] Age rating questionnaire is completed accurately
- [ ] Content matches the declared age rating
- [ ] Simulated gambling content is disclosed in the rating

### Privacy Policy Accessible
- [ ] Privacy policy link is present in the app settings or about screen
- [ ] Privacy policy link is provided in the Play Store listing
- [ ] Privacy policy covers data collection (Google account info, bet data)
- [ ] Privacy policy covers data storage and retention practices
- [ ] Privacy policy covers third-party services (Google OAuth, Gemini AI)
- [ ] Data safety section in Play Store is filled out accurately
