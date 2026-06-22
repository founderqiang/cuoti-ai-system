import unittest

from backend.app import app


class AppSecurityTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_health_reports_safe_plot_default(self):
        response = self.client.get('/api/health')

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload['status'], 'ok')
        self.assertFalse(payload['unsafe_plot_code_enabled'])

    def test_model_generated_plot_code_is_blocked_by_default(self):
        response = self.client.post(
            '/api/render_plot',
            json={'code': "raise RuntimeError('must not run')"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn('默认关闭', response.get_json()['error'])


if __name__ == '__main__':
    unittest.main()
