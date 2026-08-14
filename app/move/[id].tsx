import { useLocalSearchParams } from 'expo-router';

import { MovePickerScreen } from '../../components/MovePickerScreen';

export default function Move() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MovePickerScreen movingId={id} />;
}
