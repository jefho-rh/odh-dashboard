import { appChrome } from '../appChrome';

class AutomlExperimentsPage {
  visit(namespace: string) {
    cy.visitWithLogin('/');
    cy.reload();
    this.findNavItem().should('exist');
    cy.visit(`/develop-train/automl/experiments/${namespace}`);
    this.wait();
  }

  private wait() {
    cy.findByRole('heading', { name: /automl/i, level: 1 });
    cy.testA11y();
  }

  findNavItem() {
    return appChrome.findNavItem({ name: 'AutoML', rootSection: 'Develop & train' });
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

export const automlExperimentsPage = new AutomlExperimentsPage();
