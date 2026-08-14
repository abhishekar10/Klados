import { useLocalSearchParams } from 'expo-router';

import { ExplorerScreen } from '../../components/ExplorerScreen';

export default function NodeExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExplorerScreen currentId={id} />;
}
