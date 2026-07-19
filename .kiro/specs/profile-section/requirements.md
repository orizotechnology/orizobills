# Requirements Document

## Introduction

The Profile Section is a personal and business settings hub within the Orizo Bills ERP system. It is accessible from the sidebar user avatar area and provides the logged-in user with a single page to manage their personal profile (display name, avatar colour, password), configure business identity details (used for invoices and receipts), and view a live summary of key business statistics. The page is implemented as a TypeScript/React component at `src/app/profile/ProfilePage.tsx`, replacing any prior JSX implementation.

## Glossary

- **Profile_Page**: The top-level React component rendered at `/app/profile` that hosts all three sections.
- **Auth_Store**: The Zustand store (`useAuthStore`) that holds the currently logged-in user's `name`, `mobile`, `passwordHash`, and `registeredAt` fields, persisted via `localStorage` under the key `orizo-auth`.
- **Business_Store**: A new Zustand store (`useBusinessStore`) that holds business identity fields, persisted via `localStorage` under the key `orizo-business`.
- **Print_Settings**: The `localStorage` key `orizo-print-settings` used by the invoice/receipt print subsystem to read business identity values.
- **Avatar**: A circular element rendered in the sidebar and on the Profile Page that displays the first letter of the user's display name on a configurable background colour.
- **Avatar_Color**: A hex colour string chosen by the user to style their Avatar background.
- **Display_Name**: The user-visible name stored in `Auth_Store`, shown in the sidebar and as the Avatar initial.
- **Business_Details**: A set of optional business identity fields: business name, phone, address, email, GSTIN, UPI ID, website, and state.
- **Stats_Panel**: A read-only card grid on the Profile Page showing computed business metrics.
- **Low_Stock_Threshold**: The minimum quantity below which a product is considered low stock, defaulting to 10 units as configured in product settings.

---

## Requirements

### Requirement 1: My Profile — View and Edit Display Name

**User Story:** As a logged-in user, I want to view and update my display name, so that the sidebar and the rest of the application show my preferred name.

#### Acceptance Criteria

1. WHEN the Profile_Page renders, THE Profile_Page SHALL display the current `Display_Name` from `Auth_Store` in an editable text field.
2. WHEN the user submits a new `Display_Name` that is between 2 and 60 characters, THE Profile_Page SHALL update the `name` field in `Auth_Store` and reflect the new name immediately in the sidebar Avatar and user info area without requiring a page reload.
3. IF the user submits a `Display_Name` shorter than 2 characters or longer than 60 characters, THEN THE Profile_Page SHALL display an inline validation error message and SHALL NOT update `Auth_Store`.
4. IF the user submits a `Display_Name` consisting entirely of whitespace characters, THEN THE Profile_Page SHALL display an inline validation error and SHALL NOT update `Auth_Store`.

---

### Requirement 2: My Profile — Avatar Colour Picker

**User Story:** As a logged-in user, I want to choose a colour for my avatar, so that I can personalise my identity within the application.

#### Acceptance Criteria

1. WHEN the Profile_Page renders, THE Profile_Page SHALL display a colour picker with at least 8 predefined colour swatches.
2. WHEN the user selects an `Avatar_Color` swatch, THE Profile_Page SHALL immediately update the Avatar preview on the Profile_Page to use the selected colour as its background.
3. WHEN the user saves the profile with a chosen `Avatar_Color`, THE Auth_Store SHALL persist the selected `Avatar_Color` alongside the user record.
4. WHEN the sidebar renders after an `Avatar_Color` has been saved, THE Sidebar SHALL apply the persisted `Avatar_Color` as the Avatar background colour.
5. IF no `Avatar_Color` has been saved, THEN THE Sidebar SHALL display the Avatar with the default colour `#F97316`.

---

### Requirement 3: My Profile — Password Change

**User Story:** As a logged-in user, I want to change my password, so that I can maintain the security of my account.

#### Acceptance Criteria

1. THE Profile_Page SHALL provide a password change form with three fields: current password, new password, and confirm new password.
2. WHEN the user submits the password change form, THE Profile_Page SHALL verify that the current password field matches the bcrypt hash stored in `Auth_Store`.
3. IF the current password does not match the stored hash, THEN THE Profile_Page SHALL display an error message and SHALL NOT update the password.
4. IF the new password is shorter than 6 characters, THEN THE Profile_Page SHALL display a validation error and SHALL NOT update the password.
5. IF the new password and confirm new password fields do not match, THEN THE Profile_Page SHALL display a validation error and SHALL NOT update the password.
6. WHEN all validations pass, THE Profile_Page SHALL hash the new password using bcrypt with a salt factor of 10 and update the `passwordHash` field in `Auth_Store`.
7. WHEN the password is updated successfully, THE Profile_Page SHALL clear all three password fields and display a success confirmation message.

---

### Requirement 4: Business Details — View and Edit

**User Story:** As a logged-in user, I want to view and edit my business identity details, so that the correct information appears on invoices and receipts.

#### Acceptance Criteria

1. WHEN the Profile_Page renders, THE Profile_Page SHALL display the current values of all `Business_Details` fields (business name, phone, address, email, GSTIN, UPI ID, website, state) loaded from `Business_Store`.
2. WHEN the user saves `Business_Details`, THE Profile_Page SHALL persist all field values to `Business_Store` in `localStorage`.
3. IF a `Business_Details` field value is an empty string, THEN THE Business_Store SHALL store an empty string for that field and THE Profile_Page SHALL accept the save without error.
4. WHEN `Business_Details` are saved, THE Profile_Page SHALL synchronise the following fields to `Print_Settings` in `localStorage`: business name, phone, address, email, GSTIN, and state.
5. WHEN the user enters a GSTIN value, THE Profile_Page SHALL validate that the value matches the pattern `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}` before saving; IF the value does not match, THEN THE Profile_Page SHALL display an inline validation error for the GSTIN field and SHALL NOT save until corrected or the GSTIN field is left empty.
6. WHEN the user enters a phone number, THE Profile_Page SHALL validate that the value contains only digits, spaces, hyphens, or a leading plus sign and is between 7 and 15 digits in length; IF invalid, THEN THE Profile_Page SHALL display an inline validation error.

---

### Requirement 5: Business Stats — Summary Panel

**User Story:** As a logged-in user, I want to see a quick summary of key business metrics on my profile page, so that I can get an at-a-glance view of business performance without navigating to the reports section.

#### Acceptance Criteria

1. WHEN the Profile_Page renders, THE Stats_Panel SHALL display four metric cards: Total Sales (all-time revenue), Sales This Month (current calendar month revenue), Total Products (count of active products), and Low Stock Items (count of active products whose quantity is at or below the `Low_Stock_Threshold`).
2. WHEN the Profile_Page mounts, THE Profile_Page SHALL fetch sales data from the `/sales/summary` API endpoint and products data from the `/products` API endpoint to populate the Stats_Panel.
3. WHILE data is being fetched, THE Stats_Panel SHALL display a loading skeleton for each metric card.
4. IF a network error or non-2xx response is received during stats fetch, THEN THE Stats_Panel SHALL display a non-blocking error state per card with a retry option, and SHALL NOT prevent the rest of the Profile_Page from rendering.
5. THE Stats_Panel SHALL be read-only; THE Profile_Page SHALL NOT provide any controls to edit stat values directly.

---

### Requirement 6: Sidebar Reactivity

**User Story:** As a logged-in user, I want the sidebar to instantly reflect any profile changes I save, so that I do not need to reload the application to see updated information.

#### Acceptance Criteria

1. WHEN the user saves an updated `Display_Name` on the Profile_Page, THE Sidebar SHALL re-render and display the new name without a page reload.
2. WHEN the user saves a new `Avatar_Color` on the Profile_Page, THE Sidebar SHALL re-render and apply the new background colour to the Avatar without a page reload.
3. THE Sidebar SHALL derive the Avatar initial letter from the first character of the current `Display_Name` in `Auth_Store`, converted to uppercase.

---

### Requirement 7: Profile Page Navigation

**User Story:** As a logged-in user, I want to navigate to the Profile page from the sidebar, so that I can easily access my personal and business settings.

#### Acceptance Criteria

1. THE Sidebar SHALL display a clickable user profile area at the bottom that navigates to `/app/profile` when clicked.
2. WHEN the current route is `/app/profile`, THE Sidebar SHALL visually highlight the profile area to indicate it is the active section.
3. THE Profile_Page SHALL be accessible at the route `/app/profile` and rendered within the standard `AppLayout` wrapper.
