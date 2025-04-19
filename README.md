# Project Management API

A production-ready backend API for managing projects, tasks, and notes in a collaborative environment.

## Features

- **Authentication & Authorization**: Secure JWT-based authentication
- **Project Management**: Create and manage projects with multiple team members
- **Task Management**: Assign, track, and update tasks within projects
- **Project Notes**: Create and share notes within project context
- **Role-Based Access Control**: Different permissions for project creators, members, and admins
- **Pagination & Filtering**: Support for paginated results with various filtering options

## API Endpoints

### Authentication

- Register, login, logout functionality
- Email verification
- Password reset
- Token refresh

### Projects

- Create, read, update, and delete projects
- Add/remove project members
- Update project member roles

### Tasks

- Create and assign tasks
- Update task status, priority, and details
- Filter tasks by various attributes

### Notes

- Create notes within projects
- Update and delete notes
- View all notes for a specific project

## Technical Stack

- **Node.js & Express**: Backend framework
- **MongoDB**: Database with Mongoose ODM
- **JWT**: For secure authentication
- **Transaction Support**: Ensures data consistency

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file based on the `.env.example` template
4. Start the development server: `npm run dev`

## Environment Variables

Required environment variables are documented in the `.env.example` file. These include:
- Database connection strings
- JWT secrets
- Email configuration
- Other application settings

## Error Handling

The API implements standardized error responses using custom ApiError and ApiResponse classes for consistent client-side handling.

## Security Features

- Input validation and sanitization
- Protection against common web vulnerabilities
- Secure password hashing
- MongoDB injection prevention

## License

MIT License

----

[Suman Sarkar](https://x.com/suuumans)