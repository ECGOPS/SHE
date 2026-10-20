import { Box, Stack, Typography } from '@mui/material';

export interface PrivacyNoticeSection {
  heading: string;
  paragraphs: string[];
}

export function PrivacyNoticeBody({
  effectiveDate,
  sections,
}: {
  effectiveDate: string;
  sections: PrivacyNoticeSection[];
}) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" fontWeight={700}>Effective Date: {effectiveDate}</Typography>
      {sections.map((section) => (
        <Box key={section.heading}>
          <Typography variant="subtitle2" fontWeight={700}>{section.heading}</Typography>
          {section.paragraphs.map((paragraph) => (
            <Typography key={paragraph} variant="body2" color="text.secondary">{paragraph}</Typography>
          ))}
        </Box>
      ))}
    </Stack>
  );
}
