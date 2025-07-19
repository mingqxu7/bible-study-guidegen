# Vercel Environment Variables to Check

Please verify these environment variables in your Vercel project settings:

## Required Variables

1. **ANTHROPIC_MODEL**
   - Current default in code: `claude-sonnet-4-20250514`
   - Make sure this is set to the same model or remove it to use the default
   - If using Claude 3.5, it might not follow the verbatim quotes instructions as well

2. **MAX_OUTPUT_TOKENS**
   - Current default in code: `24000`
   - If this is set to a lower value on Vercel (e.g., 16000), responses might be truncated
   - Recommended: Set to `24000` or higher

3. **ANTHROPIC_API_KEY**
   - Make sure this is set and valid

## Debugging Steps

1. Check Vercel deployment logs to see which branch/commit is deployed
2. Verify the environment variables in Vercel dashboard:
   - Go to your project settings
   - Navigate to Environment Variables
   - Check the values for the variables above

3. Test with a simple passage (e.g., John 3:16) to see if verbatim quotes appear
4. Check the browser console for any errors
5. Look at the Network tab to see the actual API response

## Quick Fix

If you want to ensure verbatim quotes work regardless of model:
- Set `ANTHROPIC_MODEL` to `claude-sonnet-4-20250514` in Vercel
- Set `MAX_OUTPUT_TOKENS` to `24000` in Vercel