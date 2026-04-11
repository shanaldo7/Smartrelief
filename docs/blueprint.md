# **App Name**: Kindred Connect

## Core Features:

- Volunteer Profile Creation: Allows volunteers to register by submitting their name, key skills, and geographical location via a simple form.
- Task Submission: Enables organizations or individuals to submit new tasks/needs, specifying the type of help required, location, and urgency level (high, medium, low), which translates to a numerical priority (3, 2, 1).
- Data Storage with Firestore: Securely store all volunteer profiles and submitted task details, including their assigned priority, in Firebase Firestore.
- Task & Volunteer Dashboard: A centralized dashboard to view all active tasks and available volunteer profiles, facilitating an overview of ongoing needs and resources.
- Smart Task Description Assistant: An AI tool that suggests enhancements to task descriptions, ensuring they are clear, engaging, and structured to attract the most suitable volunteers.
- Intelligent Volunteer Matching: Automatically match registered volunteers to tasks. The matching process will prioritize tasks with higher urgency levels (high > medium > low), then consider overlapping skills and geographical proximity for the best fit.
- Matched Opportunities Display: Present the matched volunteer-to-task opportunities clearly on the dashboard, showing the proposed pairings.

## Style Guidelines:

- Light color scheme with a clean, modern aesthetic. Primary color: a reassuring and clear blue (#2E8AB8), symbolizing trust and reliability. This will be used for interactive elements, key headings, and primary buttons.
- Background color: A very light, desaturated shade of the primary blue (#DEEDF2), creating a clean and spacious canvas that feels calm and open.
- Accent color: A vibrant, analogous teal-green (#2AD0A9) to highlight calls to action, important notifications, and secondary buttons, ensuring high visibility and a fresh contrast.
- Primary font: 'Inter' (sans-serif) for all text elements. Its modern, highly readable, and neutral characteristics ensure clarity and a beginner-friendly experience across headlines, body text, and button labels.
- Use simple, clean line-art icons that complement the clean UI. Icons should be easily understandable, representing actions like 'add', 'edit', 'match', and 'location', integrated subtly within buttons and informational displays.
- A minimalist, card-based layout for tasks and volunteer profiles, making information digestible and easy to scan. Each card will have a subtle shadow and rounded corners for a modern look. Utilize ample white space to reduce cognitive load and enhance readability.
- Interactive elements such as buttons will have a clean, flat design with a subtle hover effect, using the defined primary and accent colors for clear distinction.