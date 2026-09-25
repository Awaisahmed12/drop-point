## Collaboration, Sharing and Organization

Views group properties, color their pins, and can be shared with a team.
Inside a property, each folder and file is private to whoever added it until
it is marked Shared, so a person keeps their own files next to the team's.

### 1. Database setup

Run once in the Supabase SQL editor, after the base schema:

```sql
\i database/collaboration.sql
```

It is additive: three new tables (`tags`, `tag_members`, `property_tags`,
plus `file_tags` for later), a `visibility` column on `property_files` and
`property_folders`, helper functions, and row-level-security policies that
widen access. The existing owner-only policies keep working next to them.
The app runs without the migration; views simply stay empty.

### 2. The model

| Thing | What it is |
|---|---|
| View (`tags`) | A named, colored label one person owns: "Company Investments LLC", "Under Contract", "Gas Stations". A property can carry many. |
| Switch | Every view is on or off per device, like a calendar's checkbox. A property shows when any of its views is on; properties with no view have their own switch. Pins take the color of the first switched-on view they carry. |
| New pins | "Add Property" saves the pin right away (so does naming it). If the map is narrowed to one view ("Show Only This View", or every other switch off), the new property joins that view. Otherwise, when there are views to choose from, the sheet opens the Views picker once; dismiss it to leave the property in no view. |
| Sharing a view | Add people by email as viewers or editors. They see every property carrying the view. Invites are bound to the account the first time that email signs in (`claim_tag_invites`). |
| Shared folder / file | Visible to everyone who can see the property. Uploads inherit the folder they land in; at the root, the owner's uploads are private and a collaborator's are shared. Sharing a folder opens the folders above it (so it can be reached) and everything inside it; making it private closes everything inside it (`set_folder_visibility`, one transaction). |
| Private folder / file | Only its uploader sees it, on any property, including the property's owner. This is how "my own files plus the shared files" works. |

Who may do what:

- Only a property's owner puts it in a view (their own views, or ones they can edit). Sharing a property is always the owner's act.
- Editors of a view can upload to properties in it, create folders, and put their own properties in the view. Viewers only look.
- The uploader and the property's owner can rename, move, delete, or change the sharing of a file or folder.
- Only a view's owner sees and manages its member list. Members can leave.

### 3. Where it lives in the app

- Map: the pins are colored by view; on a phone, chips under the search field switch views on and off and the first chip opens the Views sheet. On desktop the sidebar has a Views section with the same switches and an Edit link.
- Properties: cards show their views and a Shared badge; the same chips sit under the title on a phone.
- Property sheet: "⋯ → Views…" is a checkmark menu that stays open while you toggle, with "New View…" at the bottom. On a shared property, folder and file menus offer "Share with Team" / "Make Private", and shared rows carry a people mark. Viewers don't see the add controls.
- Views sheet: one switch per view, "⋯" for Show Only This View, Rename, Change Color, Share, Delete (or Leave for a view shared with you), and a "New View…" row. Share is a page inside the sheet: people, their access, Add Person.

### 4. Code map

- `database/collaboration.sql`: schema, helper functions, policies (tables and storage).
- `src/services/TagService.ts`: views, members, property membership.
- `src/hooks/useTagViews.ts`: the one store of views and switches (persisted under `droppoint-hidden-views`).
- `utils/tagViews.ts`: pure rules (visibility, pin color, ordering) with tests.
- `src/components/ViewsSheet.tsx`, `ViewChips.tsx`, `InputAlert.tsx`: the interface.
- `usePropertyFileActions`: uploads and folders inherit visibility; `setFileVisibility` / `setFolderVisibility`.

### 5. Not yet

- Tagging individual files: the `file_tags` table and its policies exist; there is no interface for it yet.
- Names of teammates: member rows show the email. Profiles are private to their owner, so a display name would need a small public-profile view.
- Notifications when something is shared with you. (Reminders on documents do email; see `docs/reminders.md`.)
