import { Alert, Button } from '@mui/material';

function when(ts: number | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}

export function FormDraftBanner(props: {
  hasDraft: boolean;
  restoredAt: number | null;
  savedAt: number | null;
  noun?: string;
  onContinue?: () => void;
  onDiscard?: () => void;
}) {
  if (!props.hasDraft) return null;
  const noun = props.noun ?? 'form';
  const resumed = !!props.restoredAt;
  return (
    <Alert
      severity="info"
      action={
        <>
          {props.onContinue && (
            <Button color="inherit" size="small" onClick={props.onContinue}>
              Continue
            </Button>
          )}
          {props.onDiscard && (
            <Button color="inherit" size="small" onClick={props.onDiscard}>
              Start over
            </Button>
          )}
        </>
      }
    >
      {resumed
        ? `Your unfinished ${noun} was restored (${when(props.restoredAt)}). It stays on this phone until you submit.`
        : `This ${noun} is saved on this phone. If the page closes, you can pick up from here.`}
      {props.savedAt && !resumed ? ` Last saved ${when(props.savedAt)}.` : ''}
    </Alert>
  );
}
