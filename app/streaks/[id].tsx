import { useLocalSearchParams } from 'expo-router';

import { StreakCalendarScreen } from '../../components/StreakCalendarScreen';

export default function Streaks() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StreakCalendarScreen goalId={id} />;
}
