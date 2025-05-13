# **App Name**: IASL EC Manager

## Core Features:

- User Authentication and Authorization: Role-based access control system with email and Google sign-in. Inspectors have access to the main inspection workflow, and admins have access to overall data
- Dynamic Checklist: A structured checklist form, where fields become active and inactive, and new fields are revealed, based on user selections and selections made available based on user role.
- Data Collection: System to collect data such as timestamps, inspector ID, vehicle VIN, checklist data, and photo URLs and allow the LLM tool to use it
- AI Damage Report: AI powered damage report. If there are notes and photos of damage, automatically create a summary damage report for review using a LLM tool.
- PDF Generation: Generation of a PDF summary with all data collected during the inspection, which may include user identity information, role, photos, damage assessments, etc

## Style Guidelines:

- Primary color: Deep blue (#0A214F) for professionalism and reliability.
- Secondary color: Light gray (#F0F0F0) for clean backgrounds and neutral elements.
- Accent: Teal (#008080) for interactive elements and call-to-action buttons.
- Clear, sans-serif fonts for readability and data presentation.
- Simple, vector-based icons for UI elements and inspection categories.
- A tabbed layout or multi-step form approach to break down the inspection workflow into manageable steps.
- Subtle transitions and loading animations to enhance user experience and provide feedback.