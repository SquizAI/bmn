import { markdownToHtml } from '@/lib/blog';

interface BlogProseProps {
  content: string;
}

export function BlogProse({ content }: BlogProseProps) {
  const html = markdownToHtml(content);

  return (
    <div
      className="blog-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
