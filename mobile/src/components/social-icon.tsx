import { SymbolView } from 'expo-symbols';

const names = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  activity: { ios: 'calendar', android: 'event', web: 'event' },
  project: { ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' },
  notification: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  account: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  message: { ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' },
  group: { ios: 'person.2.fill', android: 'groups', web: 'groups' },
  heart: { ios: 'heart', android: 'favorite', web: 'favorite' },
  heartFilled: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  comment: { ios: 'bubble.left', android: 'chat_bubble', web: 'chat_bubble' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  location: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
  filter: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
} as const;

export type SocialIconName = keyof typeof names;

export function SocialIcon({ name, color, size = 22 }: { name: SocialIconName; color: React.ComponentProps<typeof SymbolView>['tintColor']; size?: number }) {
  return <SymbolView name={names[name]} tintColor={color} size={size} />;
}
