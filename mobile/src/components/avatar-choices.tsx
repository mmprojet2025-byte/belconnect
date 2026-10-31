import { Pressable, StyleSheet, View } from 'react-native';
import { avatarChoices, SocialAvatar } from '@/components/social-avatar';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  name: string;
  selected: string | null;
  disabled?: boolean;
  onSelect: (code: string) => void;
  label: string;
};

export function AvatarChoices({ name, selected, disabled, onSelect, label }: Props) {
  return <View style={styles.choices}>{avatarChoices.map(code =>
    <Pressable key={code} accessibilityRole="button" accessibilityLabel={`${label} ${code}`} accessibilityState={{ selected: selected === code, disabled }} disabled={disabled} onPress={() => onSelect(code)} style={[styles.choice, selected === code && styles.selected]}>
      <SocialAvatar name={name} avatarCode={code} size={64} />
    </Pressable>
  )}</View>;
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: Spacing.one },
  choice: { padding: Spacing.one, borderRadius: 50, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: Colors.brand },
});
