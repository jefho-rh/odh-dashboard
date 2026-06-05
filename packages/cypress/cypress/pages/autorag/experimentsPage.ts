import { appChrome } from '../appChrome';

class AutoragExperimentsPage {
  visit(namespace: string) {
    cy.visitWithLogin('/');
    cy.reload();
    this.findNavItem().should('exist');
    cy.visit(`/gen-ai-studio/autorag/experiments/${namespace}`);
    this.wait();
  }

  private wait() {
    cy.findByRole('heading', { name: /autorag/i, level: 1 });
    cy.testA11y();
  }

  findNavItem() {
    return appChrome.findNavItem({ name: 'AutoRAG', rootSection: 'Gen AI studio' });
  }

  findEmptyState(timeout?: number) {
    return cy.get('.pf-v6-c-empty-state', timeout ? { timeout } : undefined);
  }

  findCreateRunButton() {
    return cy.contains('a, button', /create.*run/i);
  }

  findHeaderCreateRunButton() {
    return cy.contains('a, button', /create.*run/i);
  }
}

export const autoragExperimentsPage = new AutoragExperimentsPage();
