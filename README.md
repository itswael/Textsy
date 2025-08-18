# Textsy 📱

**Connect with people who share your interests**

Textsy is a React Native mobile application that enables users to discover and connect with people based on shared interests. Built with modern technologies and a focus on privacy and security.

## 🚀 Features

### MVP Features (Current)
- **User Authentication**: Email/password and Google OAuth sign-in
- **Profile Management**: Create and customize your profile with interests and bio
- **Interest-Based Discovery**: Find users who share your passions
- **Chat Interface**: View and manage your conversations
- **Modern UI**: Beautiful, responsive design with light/dark theme support
- **Privacy Controls**: Manage your online status and location sharing

### Planned Features (Future)
- **Real-time Messaging**: WebSocket-based instant messaging
- **Group Chats**: Connect with multiple people at once
- **AI Icebreakers**: Smart conversation starters for new matches
- **Voice Messages**: Send audio messages to your connections
- **Media Sharing**: Share images and videos in conversations
- **Nearby Discovery**: Find users in your area

## 🛠️ Tech Stack

- **Frontend**: React Native + Expo
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: React Context API
- **Storage**: AsyncStorage (local), Firebase (planned)
- **Authentication**: Firebase Auth (planned)
- **Real-time**: Socket.io (planned)
- **Database**: PostgreSQL + Redis (planned)

## 📱 Screenshots

*Screenshots will be added as the app develops*

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development) or Android Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/textsy.git
   cd textsy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on your device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

### Development Commands

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web

# Lint code
npm run lint

# Reset project (removes example code)
npm run reset-project
```

## 🏗️ Project Structure

```
textsy/
├── app/                    # Main application screens
│   ├── auth/              # Authentication screens
│   │   ├── login.tsx      # Login screen
│   │   ├── signup.tsx     # Registration screen
│   │   └── _layout.tsx    # Auth navigation
│   ├── (tabs)/            # Main app tabs
│   │   ├── chat.tsx       # Chat list screen
│   │   ├── explore.tsx    # User discovery screen
│   │   ├── profile.tsx    # User profile screen
│   │   └── _layout.tsx    # Tab navigation
│   └── _layout.tsx        # Root layout with auth
├── components/             # Reusable UI components
│   ├── ThemedText.tsx     # Theme-aware text component
│   ├── ThemedView.tsx     # Theme-aware view component
│   └── ui/                # UI-specific components
├── contexts/               # React Context providers
│   └── AuthContext.tsx    # Authentication context
├── constants/              # App constants
│   └── Colors.ts          # Color definitions
├── hooks/                  # Custom React hooks
│   └── useColorScheme.ts  # Theme hook
└── assets/                 # Images, fonts, and other assets
```

## 🔐 Authentication

The app currently uses mock authentication for development purposes. Users can:
- Sign up with email, password, name, bio, and interests
- Sign in with email and password
- Use Google OAuth (mock implementation)
- Manage profile information

**Note**: Real Firebase authentication will be implemented in Phase 2.

## 🎨 UI/UX Features

- **Responsive Design**: Optimized for all screen sizes
- **Theme Support**: Light and dark mode with automatic switching
- **Modern Components**: Clean, intuitive interface elements
- **Accessibility**: Built with accessibility best practices
- **Smooth Animations**: Engaging user interactions

## 📊 Current Status

### ✅ Completed (Phase 1)
- [x] Project setup and configuration
- [x] Authentication system (mock)
- [x] User profile management
- [x] Interest-based user discovery
- [x] Chat interface structure
- [x] Navigation and routing
- [x] Theme system
- [x] Basic UI components

### 🚧 In Progress (Phase 2)
- [ ] Real-time messaging implementation
- [ ] Individual chat screens
- [ ] WebSocket integration
- [ ] Message storage and persistence

### 📋 Planned (Phase 3 & 4)
- [ ] Firebase backend integration
- [ ] User blocking and reporting
- [ ] End-to-end encryption
- [ ] Push notifications
- [ ] Performance optimization

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use consistent code formatting
- Write meaningful commit messages
- Test on both iOS and Android
- Follow the existing component patterns

## 🐛 Known Issues

- Mock authentication (will be replaced with Firebase)
- No real-time messaging yet
- Limited offline functionality
- No push notifications

## 📱 Platform Support

- ✅ iOS (iPhone, iPad)
- ✅ Android
- ✅ Web (basic support)

## 🔒 Privacy & Security

Textsy is built with privacy and security in mind:
- User data is stored locally (will be encrypted in production)
- No unnecessary permissions requested
- Privacy controls for location and online status
- User blocking and reporting features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/)
- UI components inspired by modern design systems
- Icons from [SF Symbols](https://developer.apple.com/sf-symbols/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/textsy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/textsy/discussions)
- **Email**: support@textsy.app

---

**Made with ❤️ for meaningful connections**
