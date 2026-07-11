import { Router } from 'expo-router';

export type ExternalLink = {
  url: string;
  title: string;
};

export function openExternalPage(router: Router, link: ExternalLink) {
  router.push({
    pathname: '/external' as never,
    params: link,
  });
}
